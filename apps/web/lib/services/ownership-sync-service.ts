import type { GameRepository } from "@/lib/data";
import type { ChainGateway } from "@/lib/web3/chain-gateway";

export class OwnershipSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OwnershipSyncError";
  }
}

export interface OwnershipSyncResult {
  owner: string | null;
  onchainOwner: string;
  changed: boolean;
}

/**
 * Ownership sync for a single MINT_CONFIRMED monster.
 * Source of truth: MonsterNFT.ownerOf(tokenId).
 *  - owner has a verified ChainMon trainer → monster.owner = trainer
 *  - owner has no ChainMon account        → monster.owner = null,
 *    onchainOwnerAddress = wallet (External Owner — gameplay locked)
 * Stale team slots are removed either way.
 */
export async function syncMonsterOwnership(
  repository: GameRepository,
  gateway: ChainGateway,
  monsterId: string,
): Promise<OwnershipSyncResult> {
  const monster = await repository.getMonster(monsterId);
  if (!monster) throw new OwnershipSyncError("Monster not found.");
  if (monster.mintStatus !== "MINT_CONFIRMED" || !monster.tokenId) {
    // Off-chain monsters keep the game DB ownership.
    return { owner: monster.owner, onchainOwner: "", changed: false };
  }

  const owner = (await gateway.getOwner(BigInt(monster.tokenId))).toLowerCase();
  const trainerId = await repository.getTrainerByWallet(owner);

  const changed =
    monster.owner !== trainerId ||
    (monster.onchainOwnerAddress ?? null) !== owner;

  await repository.setMonsterOwner(monsterId, trainerId, owner);
  return { owner: trainerId, onchainOwner: owner, changed };
}

/**
 * Reconcile every minted monster currently owned by a wallet (used after
 * wallet binding — asset recovery without re-minting).
 */
export async function syncByWallet(
  repository: GameRepository,
  gateway: ChainGateway,
  walletAddress: string,
): Promise<number> {
  const canonical = walletAddress.toLowerCase();
  const monsters = await repository.getMonstersByOnchainOwner(canonical);
  let changedCount = 0;
  for (const monster of monsters) {
    try {
      const result = await syncMonsterOwnership(repository, gateway, monster.id);
      if (result.changed) changedCount += 1;
    } catch {
      // RPC hiccup — skip; a later sync retries.
    }
  }
  return changedCount;
}

/**
 * Assert the trainer can use a monster for gameplay (team / battle):
 * MINT_CONFIRMED monsters must be owned on-chain by the trainer's wallet.
 * Off-chain monsters are always usable.
 */
export async function assertGameplayOwnership(
  repository: GameRepository,
  gateway: ChainGateway,
  trainerId: string,
  monsterId: string,
): Promise<void> {
  const monster = await repository.getMonster(monsterId);
  if (!monster) throw new OwnershipSyncError("Monster not found.");
  if (monster.mintStatus !== "MINT_CONFIRMED" || !monster.tokenId) return;

  const wallet = await repository.getVerifiedWallet(trainerId);
  if (!wallet) {
    throw new OwnershipSyncError(
      "This monster is minted — verify a wallet before using it.",
    );
  }
  const owner = (await gateway.getOwner(BigInt(monster.tokenId))).toLowerCase();
  if (owner !== wallet) {
    await repository.setOwnershipMismatch(monsterId, true);
    throw new OwnershipSyncError("NFT ownership mismatch.");
  }
  await repository.setOwnershipMismatch(monsterId, false);
}
