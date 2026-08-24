import {
  checkEvolutionEligibility,
  EVOLUTION_ITEM_SLUGS,
  evolveMonsterData,
} from "@chainmon/game-engine";
import { getEvolutionStage, getSpeciesById } from "@chainmon/monster-data";
import type { Monster } from "@chainmon/shared";
import type { GameRepository, OnchainEvolutionJob } from "@/lib/data";
import type { ChainGateway } from "@/lib/web3/chain-gateway";
import { assertNotListed } from "./marketplace-service";
import { normalizeWeb3Error } from "./nft-claim-service";

export class EvolutionSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvolutionSyncError";
  }
}

export interface EvolutionSyncResult {
  status:
    | "pending"
    | "submitted"
    | "chain-confirmed"
    | "synced"
    | "failed"
    | "already-synced";
  txHash?: string;
  error?: string;
}

const ACTIVE_JOB_STATUSES = [
  "EVOLUTION_PENDING",
  "EVOLUTION_SUBMITTED",
  "CHAIN_CONFIRMED",
] as const;

/**
 * Two-phase evolution for MINT_CONFIRMED monsters:
 *   validate → chain tx → receipt → read back → off-chain commit (reuse
 *   Phase 5 commitEvolution). Chain-first ordering prevents item loss on
 *   revert; CHAIN_CONFIRMED jobs can retry the DB commit without re-sending
 *   a transaction (reconciliation).
 */
export async function evolveMintedMonster(
  repository: GameRepository,
  gateway: ChainGateway,
  trainerId: string,
  monsterId: string,
): Promise<EvolutionSyncResult> {
  const monster = await repository.getMonster(monsterId);
  if (!monster) throw new EvolutionSyncError("Monster not found.");
  if (monster.owner !== trainerId) {
    throw new EvolutionSyncError("You don't own this monster.");
  }
  if (monster.mintStatus !== "MINT_CONFIRMED" || !monster.tokenId) {
    throw new EvolutionSyncError(
      "This monster is not minted — use the regular evolution flow.",
    );
  }

  // Ownership boundary check (critical edge, not per-round).
  const wallet = await repository.getVerifiedWallet(trainerId);
  if (!wallet) throw new EvolutionSyncError("Verify a wallet first.");
  const onchainOwner = (await gateway.getOwner(BigInt(monster.tokenId))).toLowerCase();
  if (onchainOwner !== wallet) {
    await repository.setOwnershipMismatch(monster.id, true);
    throw new EvolutionSyncError("NFT ownership mismatch.");
  }
  await repository.setOwnershipMismatch(monster.id, false);

  const species = getSpeciesById(monster.speciesId);
  if (!species) throw new EvolutionSyncError("Unknown species.");
  // Marketplace gameplay lock: listed monsters cannot evolve.
  await assertNotListed(repository, monsterId);
  const target = species.evolution?.evolvesTo
    ? getSpeciesById(species.evolution.evolvesTo)
    : undefined;
  if (!target) {
    throw new EvolutionSyncError("This monster has no evolution route.");
  }

  const inventory = await repository.getInventory(trainerId);
  const eligibility = checkEvolutionEligibility(monster, species, inventory);
  if (!eligibility.eligible) {
    if (eligibility.missingLevel !== undefined) {
      throw new EvolutionSyncError(
        `This monster needs to reach Level ${eligibility.missingLevel} to evolve.`,
      );
    }
    if (eligibility.missingItem) {
      throw new EvolutionSyncError(
        `Evolution requires an evolution item ×${eligibility.missingItem.quantity}.`,
      );
    }
    throw new EvolutionSyncError("Evolution is not available.");
  }

  const targetStage = getEvolutionStage(target);
  const jobs = await repository.getOnchainEvolutionByMonster(monster.id);
  const active = jobs.find((job) =>
    ACTIVE_JOB_STATUSES.includes(job.status as (typeof ACTIVE_JOB_STATUSES)[number]),
  );

  // Recovery: chain already evolved + DB commit pending.
  if (active?.status === "CHAIN_CONFIRMED") {
    return syncOffchainCommit(repository, monster, active);
  }

  // Recovery: submitted tx — resolve via receipt.
  if (active?.status === "EVOLUTION_SUBMITTED" && active.txHash) {
    const receipt = await gateway.getTransactionReceipt(
      active.txHash as `0x${string}`,
    );
    if (receipt?.status === "success") {
      const onchain = await gateway.getMonster(BigInt(monster.tokenId));
      if (
        Number(onchain.speciesId) === active.toSpeciesId &&
        Number(onchain.evolutionStage) === active.toStage
      ) {
        await repository.setOnchainEvolutionStatus(active.id, "CHAIN_CONFIRMED", {
          confirmedAt: new Date(),
        });
        return syncOffchainCommit(repository, monster, {
          ...active,
          status: "CHAIN_CONFIRMED",
        });
      }
    }
    if (receipt?.status === "reverted") {
      await repository.setOnchainEvolutionStatus(active.id, "SYNC_FAILED", {
        error: "Evolution transaction reverted on chain.",
      });
      return { status: "failed", error: "Evolution transaction reverted on chain." };
    }
    return { status: "submitted", txHash: active.txHash };
  }
  if (active) {
    return { status: "pending" }; // duplicate click protection
  }

  // Fresh job (unique per monster — no concurrent evolutions).
  const created = await repository.createOnchainEvolution(monster.id, {
    fromSpeciesId: species.id,
    toSpeciesId: target.id,
    fromStage: getEvolutionStage(species),
    toStage: targetStage,
  });
  const job = created.job;

  // Fail fast on missing role.
  const hasEvolver = await gateway.hasRole("EVOLVER", gateway.backendAddress);
  if (!hasEvolver) {
    await repository.setOnchainEvolutionStatus(job.id, "SYNC_FAILED", {
      error: "Backend wallet does not have EVOLVER_ROLE.",
    });
    return { status: "failed", error: "Backend wallet does not have EVOLVER_ROLE." };
  }

  // Submit on-chain evolution.
  let txHash: `0x${string}`;
  try {
    txHash = await gateway.evolveMonster(
      BigInt(monster.tokenId),
      target.id,
      targetStage,
    );
  } catch (error) {
    const message = normalizeWeb3Error(error);
    await repository.setOnchainEvolutionStatus(job.id, "SYNC_FAILED", {
      error: message,
    });
    return { status: "failed", error: message };
  }
  await repository.setOnchainEvolutionStatus(job.id, "EVOLUTION_SUBMITTED", {
    txHash,
    chainId: gateway.chainId,
    contractAddress: gateway.contractAddress,
  });

  // Receipt — timeout keeps EVOLUTION_SUBMITTED (recovery later).
  const receipt = await gateway.waitForTransactionReceipt(txHash, 15000);
  if (receipt === null) return { status: "submitted", txHash };
  if (receipt.status === "reverted") {
    await repository.setOnchainEvolutionStatus(job.id, "SYNC_FAILED", {
      error: "Evolution transaction reverted on chain.",
    });
    return { status: "failed", error: "Evolution transaction reverted on chain." };
  }

  // Read back before committing off-chain.
  const onchain = await gateway.getMonster(BigInt(monster.tokenId));
  if (
    Number(onchain.speciesId) !== target.id ||
    Number(onchain.evolutionStage) !== targetStage
  ) {
    await repository.setOnchainEvolutionStatus(job.id, "SYNC_FAILED", {
      error: "On-chain evolution state mismatch.",
    });
    return { status: "failed", error: "On-chain evolution state mismatch." };
  }

  await repository.setOnchainEvolutionStatus(job.id, "CHAIN_CONFIRMED", {
    confirmedAt: new Date(),
  });
  return syncOffchainCommit(repository, monster, {
    ...job,
    status: "CHAIN_CONFIRMED",
  });
}

/**
 * Off-chain commit AFTER chain confirmation (reuses Phase 5
 * commitEvolution: item consumption, species change, stat recalculation,
 * evolution history). Retry-safe: commitEvolution rejects when the species
 * already changed (already-synced), and no new chain tx is ever sent.
 */
async function syncOffchainCommit(
  repository: GameRepository,
  monster: Monster,
  job: OnchainEvolutionJob,
): Promise<EvolutionSyncResult> {
  try {
    const species = getSpeciesById(monster.speciesId);
    const target = getSpeciesById(job.toSpeciesId);
    if (!species || !target) {
      throw new EvolutionSyncError("Evolution target missing.");
    }
    const evolved = evolveMonsterData(monster, target);
    if (!monster.owner) {
      throw new EvolutionSyncError(
        "Monster has no trainer owner — cannot sync evolution.",
      );
    }
    const consumedItemSlug = species.evolution?.item
      ? EVOLUTION_ITEM_SLUGS[species.evolution.item]
      : undefined;

    const result = await repository.commitEvolution({
      monsterId: monster.id,
      trainerId: monster.owner,
      monster: evolved,
      fromSpeciesId: species.id,
      toSpeciesId: target.id,
      consumedItemSlug,
      level: monster.level,
    });
    if (result.status === "invalid") {
      return { status: "already-synced" }; // species already changed — nothing to do
    }
    if (result.status === "no-item") {
      throw new EvolutionSyncError("Required evolution item is missing.");
    }
    await repository.setOnchainEvolutionStatus(job.id, "SYNCED", {
      syncedAt: new Date(),
    });
    return { status: "synced" };
  } catch (error) {
    // DB commit failed — keep the job CHAIN_CONFIRMED so a later
    // reconcile retries the commit without sending another tx.
    await repository.setOnchainEvolutionStatus(job.id, "CHAIN_CONFIRMED", {
      error:
        error instanceof Error
          ? error.message
          : "Game state sync failed.",
    });
    return {
      status: "chain-confirmed",
      error:
        "On-chain evolution confirmed, but game sync failed. Use Retry Sync.",
    };
  }
}

/** Latest evolution job for a monster (UI status). */
export async function getEvolutionSyncState(
  repository: GameRepository,
  trainerId: string,
  monsterId: string,
): Promise<OnchainEvolutionJob | null> {
  const monster = await repository.getMonster(monsterId);
  if (!monster || monster.owner !== trainerId) return null;
  const jobs = await repository.getOnchainEvolutionByMonster(monster.id);
  return jobs[0] ?? null;
}
