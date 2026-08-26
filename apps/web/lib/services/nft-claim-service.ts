import {
  ONCHAIN_RARITY,
  type MintStatus,
  type Monster,
} from "@chainmon/shared";
import {
  getEvolutionStage,
  getSpeciesById,
  type MonsterSpeciesData,
} from "@chainmon/monster-data";
import type { GameRepository } from "@/lib/data";
import {
  ChainGateway,
  Web3Error,
} from "@/lib/web3/chain-gateway";
import { hashGameMonsterId, hashMonsterDNA } from "@/lib/web3/hash";
import type { MonsterMintPayload } from "@/lib/web3/types";

export class ClaimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaimError";
  }
}

/** A MINT_PENDING lock older than this is considered stuck (crash recovery). */
export const MINT_PENDING_TIMEOUT_MS = 5 * 60 * 1000;

export interface ClaimResult {
  status: MintStatus;
  tokenId?: string;
  txHash?: string;
  recovered?: boolean;
}

/** Server-side payload — never built from client-supplied fields. */
export function buildMintPayload(
  monster: Monster,
  species: MonsterSpeciesData,
): MonsterMintPayload {
  return {
    gameMonsterIdHash: hashGameMonsterId(monster.id),
    speciesId: species.id,
    generation: monster.generation,
    rarity: ONCHAIN_RARITY[monster.rarity],
    evolutionStage: getEvolutionStage(species),
    dnaHash: hashMonsterDNA(monster.dna),
  };
}

/** Normalize blockchain errors into short readable messages. */
export function normalizeWeb3Error(error: unknown): string {
  if (error instanceof Web3Error) {
    if (error.kind === "role") return error.message;
    if (error.kind === "config") return error.message;
    if (error.kind === "rpc") return "Blockchain RPC unavailable. Please try again.";
    if (error.kind === "reverted") return "The transaction was rejected by the contract.";
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return "The operation failed. Please try again.";
  }
  return "The operation failed. Please try again.";
}

async function confirmFromChain(
  repository: GameRepository,
  gateway: ChainGateway,
  monster: Monster,
  tokenId: bigint,
): Promise<void> {
  const data = await gateway.getMonster(tokenId);
  const owner = await gateway.getOwner(tokenId);

  // Read-back validation: payload must match exactly.
  const expectedGameId = hashGameMonsterId(monster.id);
  const expectedDna = hashMonsterDNA(monster.dna);
  if (data.gameMonsterIdHash !== expectedGameId) {
    throw new ClaimError("On-chain identity mismatch — refusing to confirm.");
  }
  if (data.dnaHash !== expectedDna) {
    throw new ClaimError("On-chain DNA mismatch — refusing to confirm.");
  }
  if (Number(data.speciesId) !== monster.speciesId) {
    throw new ClaimError("On-chain species mismatch — refusing to confirm.");
  }
  if (Number(data.generation) !== monster.generation) {
    throw new ClaimError("On-chain generation mismatch — refusing to confirm.");
  }

  await repository.setMintConfirmed(monster.id, tokenId.toString(), owner);
}

/**
 * User-initiated NFT claim:
 *   reconcile → lock (CAS) → build payload → submit → receipt → read back → confirm
 */
export async function claimNft(
  repository: GameRepository,
  gateway: ChainGateway,
  trainerId: string,
  monsterId: string,
): Promise<ClaimResult> {
  const monster = await repository.getMonsterPublic(monsterId);
  if (!monster) throw new ClaimError("Monster not found.");
  if (monster.owner !== trainerId) {
    throw new ClaimError("You don't own this monster.");
  }

  const wallet = await repository.getVerifiedWallet(trainerId);
  if (!wallet) {
    throw new ClaimError(
      "Verify a wallet first. Signature only — no transaction, no gas.",
    );
  }

  const species = getSpeciesById(monster.speciesId);
  if (!species) throw new ClaimError("Unknown monster species.");
  const gameMonsterIdHash = hashGameMonsterId(monster.id);

  // 0. Stuck MINT_PENDING recovery: only after the timeout — a fresh lock
  //    means another request is actively minting (duplicate protection).
  if (monster.mintStatus === "MINT_PENDING") {
    const updatedAt = monster.mintUpdatedAt ?? monster.mintConfirmedAt;
    const stuck =
      updatedAt === undefined ||
      Date.now() - updatedAt.getTime() > MINT_PENDING_TIMEOUT_MS;
    if (!stuck) {
      throw new ClaimError("A mint is already in progress for this monster.");
    }
    const stuckToken = await gateway.getTokenIdByGameMonsterId(gameMonsterIdHash);
    if (stuckToken > 0n) {
      await confirmFromChain(repository, gateway, monster, stuckToken);
      return {
        status: "MINT_CONFIRMED",
        tokenId: stuckToken.toString(),
        recovered: true,
      };
    }
    // No tx on chain — release the stale lock (→ FAILED) and retry below.
    await repository.releaseMintLock(monsterId);
  }

  // 1. On-chain lookup FIRST (recovery: the chain may already hold the NFT).
  const existingTokenId = await gateway.getTokenIdByGameMonsterId(gameMonsterIdHash);
  if (existingTokenId > 0n) {
    await confirmFromChain(repository, gateway, monster, existingTokenId);
    return {
      status: "MINT_CONFIRMED",
      tokenId: existingTokenId.toString(),
      recovered: true,
    };
  }

  // 2. CAS mint lock (double-click / tabs / retries → one transaction).
  const lock = await repository.tryAcquireMintLock(monsterId);
  if (lock === "confirmed") {
    const current = await repository.getMonster(monsterId, trainerId);
    return { status: "MINT_CONFIRMED", tokenId: current?.tokenId };
  }
  if (lock === "in-progress") {
    throw new ClaimError("A mint is already in progress for this monster.");
  }

  // 3. Fail fast on missing backend role (before spending gas).
  const hasMinter = await gateway.hasRole("MINTER", gateway.backendAddress);
  if (!hasMinter) {
    await repository.setMintFailed(
      monsterId,
      "Backend wallet does not have MINTER_ROLE.",
    );
    throw new ClaimError("Backend wallet does not have MINTER_ROLE.");
  }

  // 4. Server-built payload (client submits only monsterId).
  const payload = buildMintPayload(monster, species);

  // 5. Submit (backend wallet pays gas; recipient is the verified wallet).
  let txHash: `0x${string}`;
  try {
    txHash = await gateway.mintMonster(wallet as `0x${string}`, payload);
  } catch (error) {
    const message = normalizeWeb3Error(error);
    await repository.setMintFailed(monsterId, message);
    throw new ClaimError(message);
  }
  await repository.setMintSubmitted(monsterId, {
    txHash,
    chainId: gateway.chainId,
    contractAddress: gateway.contractAddress,
    recipient: wallet,
  });

  // 6. Receipt — timeout must NOT become FAILED.
  const receipt = await gateway.waitForTransactionReceipt(txHash, 15000);
  if (receipt === null) {
    return { status: "MINT_SUBMITTED", txHash };
  }
  if (receipt.status === "reverted") {
    await repository.setMintFailed(
      monsterId,
      "Mint transaction reverted on chain.",
    );
    throw new ClaimError("Mint transaction reverted on chain.");
  }

  // 7. Read back and verify before confirming.
  const confirmedTokenId = await gateway.getTokenIdByGameMonsterId(gameMonsterIdHash);
  if (confirmedTokenId > 0n) {
    await confirmFromChain(repository, gateway, monster, confirmedTokenId);
    return {
      status: "MINT_CONFIRMED",
      tokenId: confirmedTokenId.toString(),
      txHash,
    };
  }
  return { status: "MINT_SUBMITTED", txHash };
}

/**
 * Refresh / reconcile a SUBMITTED (or PENDING) mint.
 * Never flips SUBMITTED → FAILED on receipt absence or RPC errors.
 */
export async function refreshMintStatus(
  repository: GameRepository,
  gateway: ChainGateway,
  trainerId: string,
  monsterId: string,
): Promise<ClaimResult> {
  const monster = await repository.getMonsterPublic(monsterId);
  if (!monster) throw new ClaimError("Monster not found.");
  if (monster.owner !== trainerId) {
    throw new ClaimError("You don't own this monster.");
  }

  if (monster.mintStatus === "MINT_CONFIRMED") {
    return { status: "MINT_CONFIRMED", tokenId: monster.tokenId };
  }

  if (monster.mintStatus === "MINT_SUBMITTED" && monster.mintTxHash) {
    const receipt = await gateway.getTransactionReceipt(
      monster.mintTxHash as `0x${string}`,
    );
    if (receipt?.status === "success") {
      const tokenId = await gateway.getTokenIdByGameMonsterId(
        hashGameMonsterId(monster.id),
      );
      if (tokenId > 0n) {
        await confirmFromChain(repository, gateway, monster, tokenId);
        return { status: "MINT_CONFIRMED", tokenId: tokenId.toString() };
      }
      return { status: "MINT_SUBMITTED", txHash: monster.mintTxHash };
    }
    if (receipt?.status === "reverted") {
      await repository.setMintFailed(
        monsterId,
        "Mint transaction reverted on chain.",
      );
      return { status: "MINT_FAILED" };
    }
    // pending or RPC unavailable → keep SUBMITTED
    return { status: "MINT_SUBMITTED", txHash: monster.mintTxHash };
  }

  if (monster.mintStatus === "MINT_PENDING") {
    const tokenId = await gateway.getTokenIdByGameMonsterId(
      hashGameMonsterId(monster.id),
    );
    if (tokenId > 0n) {
      await confirmFromChain(repository, gateway, monster, tokenId);
      return { status: "MINT_CONFIRMED", tokenId: tokenId.toString() };
    }
    return { status: "MINT_PENDING" };
  }

  return { status: monster.mintStatus ?? "OFFCHAIN" };
}
