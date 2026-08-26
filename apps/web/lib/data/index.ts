import { prisma } from "@/lib/prisma";
import { memoryRepository } from "./memory-repository";
import { prismaRepository } from "./prisma-repository";
import type {
  BattleRecord,
  BattleRewardSettlement,
  BattleSummary,
  CaptureCommit,
  CommitCaptureResult,
  CommitEvolutionParams,
  CommitEvolutionResult,
  CreateEvolutionJobInput,
  CreateEvolutionJobResult,
  CreateListingInput,
  EvolutionHistoryRecord,
  GameRepository,
  InventoryEntry,
  ListingStatusPatch,
  MarketplaceListingRecord,
  MarketplaceListingStatus,
  MarketplaceListingWithMonster,
  MintLockResult,
  MintSubmission,
  MonsterStateView,
  MonsterStatsUpdate,
  OnchainEvolutionJob,
  RewardSettleContext,
  SubmitRoundInput,
  SubmitRoundResult,
  WalletLoginChallenge,
  WalletPlayerResult,
  WorldItemGrant,
  WorldPickupClaimRecord,
  WorldReward,
  WorldRewardClaimResult,
  WorldSpawnRecord,
} from "./types";

export type {
  BattleRecord,
  BattleRewardSettlement,
  BattleSummary,
  CaptureCommit,
  CommitCaptureResult,
  CommitEvolutionParams,
  CommitEvolutionResult,
  CreateEvolutionJobInput,
  CreateEvolutionJobResult,
  CreateListingInput,
  EvolutionHistoryRecord,
  GameRepository,
  InventoryEntry,
  ListingStatusPatch,
  MarketplaceListingRecord,
  MarketplaceListingStatus,
  MarketplaceListingWithMonster,
  MintLockResult,
  MintSubmission,
  MonsterStateView,
  MonsterStatsUpdate,
  OnchainEvolutionJob,
  RewardSettleContext,
  SubmitRoundInput,
  SubmitRoundResult,
  WalletLoginChallenge,
  WalletPlayerResult,
  WorldItemGrant,
  WorldPickupClaimRecord,
  WorldReward,
  WorldRewardClaimResult,
  WorldSpawnRecord,
};

let cachedRepository: Promise<GameRepository> | null = null;

/**
 * Data mode selection (Phase 9):
 *  - CHAINMON_DATA_MODE=prisma  → force the Prisma repository; DB failure
 *    throws (fail-closed). Production must never silently fall back to Memory.
 *  - CHAINMON_DATA_MODE=memory  → force the in-memory repository (Demo Mode).
 *  - unset → auto-detect: PostgreSQL reachable → Prisma, else Memory.
 *    Auto-detect is disabled when NODE_ENV=production (fail-closed).
 */
export function getRepository(): Promise<GameRepository> {
  cachedRepository ??= resolveRepository();
  return cachedRepository;
}

async function resolveRepository(): Promise<GameRepository> {
  const mode = process.env.CHAINMON_DATA_MODE;
  if (process.env.NODE_ENV === "production" && mode !== "prisma") {
    throw new Error(
      "production requires CHAINMON_DATA_MODE=prisma; memory/demo mode is disabled.",
    );
  }
  if (mode === "prisma") {
    // Fail-closed: probe the database once; never fall back to Memory.
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      throw new Error(
        `Database unavailable (CHAINMON_DATA_MODE=prisma): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return prismaRepository;
  }
  if (mode === "memory") {
    return memoryRepository;
  }
  // Auto-detect — allowed for development only.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Database unavailable: production requires CHAINMON_DATA_MODE=prisma and a reachable PostgreSQL.",
    );
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return prismaRepository;
  } catch {
    return memoryRepository;
  }
}
