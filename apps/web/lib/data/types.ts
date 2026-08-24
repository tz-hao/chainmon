import type {
  BattleLogEntry,
  BattleState,
  BattleStatus,
  BattleWinner,
  RoundResult,
} from "@chainmon/game-engine";
import type { WildEncounter } from "@chainmon/game-engine";
import type {
  MintStatus,
  Monster,
  MonsterDNA,
  OnchainEvolutionStatus,
  TrainerProfile,
} from "@chainmon/shared";

export interface InventoryEntry {
  slug: string;
  name: string;
  quantity: number;
}

export interface CaptureCommit {
  encounterId: string;
  trainerId: string;
  itemSlug: string;
  monster: Monster;
}

export type CommitCaptureResult = "captured" | "encounter-invalid" | "no-ball";

// ---------- Progression / Rewards (Phase 5) ----------

export interface BattleRewardSettlement {
  gold: number;
  monsters: {
    monsterId: string;
    expGained: number;
    oldLevel: number;
    newLevel: number;
    oldExp: number;
    newExp: number;
    unlockedSkills: string[];
  }[];
  items: { itemSlug: string; quantity: number }[];
}

/** Storage view of a collection monster used inside reward settlement. */
export interface MonsterStateView {
  id: string;
  speciesId: number;
  level: number;
  exp: number;
  dna: MonsterDNA;
  /** canonical skill string ids */
  skills: string[];
}

export interface MonsterStatsUpdate {
  level: number;
  exp: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
}

/**
 * Transaction-scoped storage primitives handed to the reward computation
 * (game formulas stay in the service/engine layers — the repository only
 * provides reads/writes).
 */
export interface RewardSettleContext {
  getMonster(id: string): Promise<MonsterStateView | null>;
  setMonsterStats(id: string, update: MonsterStatsUpdate): Promise<void>;
  /** append skills up to the 4-slot limit; returns the skills actually added */
  addMonsterSkills(id: string, skillIds: readonly string[]): Promise<string[]>;
  addGold(amount: number): Promise<void>;
  addInventory(itemSlug: string, quantity: number): Promise<void>;
}

export interface CommitEvolutionParams {
  monsterId: string;
  trainerId: string;
  /** fully recomputed evolved monster (DNA preserved by the caller) */
  monster: Monster;
  fromSpeciesId: number;
  toSpeciesId: number;
  /** evolution material slug consumed when required (e.g. "fire-stone") */
  consumedItemSlug?: string;
  level: number;
}

export interface EvolutionHistoryRecord {
  id: string;
  monsterId: string;
  fromSpeciesId: number;
  toSpeciesId: number;
  level: number;
  createdAt: Date;
}

export type CommitEvolutionResult =
  | { status: "ok"; history: EvolutionHistoryRecord }
  | { status: "invalid" }
  | { status: "no-item" };

// ---------- Wallet & NFT (Phase 7) ----------

export interface WalletChallenge {
  nonce: string;
  expiresAt: Date;
}

export interface MintSubmission {
  txHash: string;
  chainId: number;
  contractAddress: string;
  recipient: string;
}

export type MintLockResult = "acquired" | "confirmed" | "in-progress";

export interface OnchainEvolutionJob {
  id: string;
  monsterId: string;
  fromSpeciesId: number;
  toSpeciesId: number;
  fromStage: number;
  toStage: number;
  status: OnchainEvolutionStatus;
  txHash?: string;
  chainId?: number;
  contractAddress?: string;
  error?: string;
  createdAt: Date;
  submittedAt?: Date;
  confirmedAt?: Date;
  syncedAt?: Date;
}

export interface CreateEvolutionJobInput {
  fromSpeciesId: number;
  toSpeciesId: number;
  fromStage: number;
  toStage: number;
}

export type CreateEvolutionJobResult =
  | { status: "created"; job: OnchainEvolutionJob }
  | { status: "in-progress"; job: OnchainEvolutionJob };

// ---------- Marketplace & Ownership sync (Phase 8) ----------

export type MarketplaceListingStatus =
  | "PENDING"
  | "ACTIVE"
  | "CANCEL_PENDING"
  | "CANCELLED"
  | "SALE_PENDING"
  | "SOLD"
  | "STALE"
  | "FAILED";

export interface MarketplaceListingRecord {
  id: string;
  monsterId: string;
  sellerId: string;
  tokenId?: string;
  /** price in wei as a string (never a JS Number) */
  priceWei: string;
  currency: string;
  status: MarketplaceListingStatus;
  chainId?: number;
  nftContractAddress?: string;
  marketplaceAddress?: string;
  listingTxHash?: string;
  cancelTxHash?: string;
  saleTxHash?: string;
  buyerWallet?: string;
  createdAt: Date;
  updatedAt: Date;
  soldAt?: Date;
  cancelAt?: Date;
}

export interface MarketplaceListingWithMonster extends MarketplaceListingRecord {
  monster: Monster;
}

export interface CreateListingInput {
  tokenId: string;
  priceWei: string;
  chainId: number;
  nftContractAddress: string;
  marketplaceAddress: string;
}

export interface ListingStatusPatch {
  status: MarketplaceListingStatus;
  txHash?: string;
  buyerWallet?: string;
  soldAt?: Date;
  cancelAt?: Date;
}

// ---------- Battle (Phase 4) ----------

export interface BattleRecord {
  state: BattleState;
  logs: BattleLogEntry[];
  /** reward snapshot, present once a completed battle has settled rewards */
  rewards?: BattleRewardSettlement | null;
}

export interface BattleSummary {
  id: string;
  status: BattleStatus;
  winner?: BattleWinner;
  turn: number;
  createdAt: Date;
}

export interface SubmitRoundInput {
  battleId: string;
  expectedTurn: number;
  /** pure engine function executed inside the storage transaction */
  resolver: (state: BattleState) => RoundResult;
  /**
   * Reward computation executed exactly once inside the transaction on the
   * ACTIVE→COMPLETED transition. Receives transaction-scoped storage
   * primitives; returns the reward snapshot persisted to Battle.rewards.
   */
  applyRewards?: (
    ctx: RewardSettleContext,
    round: RoundResult,
  ) => Promise<BattleRewardSettlement> | BattleRewardSettlement;
}

export type SubmitRoundResult =
  | {
      status: "ok";
      state: BattleState;
      logs: BattleLogEntry[];
      rewards: BattleRewardSettlement | null;
    }
  | { status: "not-found" }
  | { status: "invalid-turn" }
  | { status: "not-active" };

/**
 * GameRepository — storage abstraction used by server components, services
 * and actions.
 *
 * Two implementations:
 *  - prismaRepository: PostgreSQL (production path)
 *  - memoryRepository: in-process fallback when no DB is reachable (Demo Mode)
 *
 * The web app never talks to a repository implementation directly — it always
 * goes through getRepository() (see index.ts), which detects availability.
 *
 * No game formulas live here — repositories only store and load data
 * (reward settlement formulas arrive via SubmitRoundInput.applyRewards).
 */
export interface GameRepository {
  readonly kind: "prisma" | "memory";

  // Trainer
  getDemoTrainer(): Promise<TrainerProfile | null>;
  createDemoTrainer(nickname: string): Promise<TrainerProfile>;

  // Monsters
  addMonster(monster: Monster): Promise<void>;
  listMonsters(): Promise<Monster[]>;
  getMonster(id: string): Promise<Monster | null>;
  /** public read — no owner filter (Phase 8 public monster view) */
  getMonsterPublic(id: string): Promise<Monster | null>;

  // Encounters
  createEncounter(encounter: WildEncounter): Promise<void>;
  getEncounterById(id: string): Promise<WildEncounter | null>;
  getActiveEncounter(trainerId: string): Promise<WildEncounter | null>;
  /** True when the encounter was ACTIVE and became CAPTURED. */
  markEncounterCaptured(id: string): Promise<boolean>;
  /** True when the encounter was ACTIVE and became FLED. */
  markEncounterFled(id: string): Promise<boolean>;

  // Inventory
  getInventory(trainerId: string): Promise<InventoryEntry[]>;
  /** Atomically decrement an item; false when quantity is 0 (or unknown item). */
  consumeItem(trainerId: string, itemSlug: string): Promise<boolean>;
  /**
   * Atomic capture commit: validate encounter ACTIVE (and ownership),
   * consume the ball, create the monster, mark the encounter CAPTURED.
   * Prevents double-spend / duplicate monsters / dangling encounters.
   */
  commitCapture(params: CaptureCommit): Promise<CommitCaptureResult>;

  // Battle team
  /** Save exactly 3 owned monster ids into slots 1-3 (replaces any prior team). */
  saveTeam(trainerId: string, monsterIds: readonly string[]): Promise<void>;
  /** The saved team as monsters (slot order), or null when not complete. */
  getTeam(trainerId: string): Promise<Monster[] | null>;

  // Battles
  createBattle(state: BattleState, playerMonsterIds: readonly string[]): Promise<void>;
  getBattleById(id: string): Promise<BattleRecord | null>;
  getTrainerBattles(trainerId: string, limit?: number): Promise<BattleSummary[]>;
  /**
   * Atomic round submission: validate ACTIVE + expectedTurn, run the
   * engine resolver, persist state + logs, bump the turn, and apply
   * battle statistics + rewards exactly once on the ACTIVE→COMPLETED
   * transition.
   */
  submitRound(input: SubmitRoundInput): Promise<SubmitRoundResult>;

  // Evolution (Phase 5)
  /**
   * Atomic evolution: validate monster + ownership + unchanged species,
   * consume the required item, update species/stats/skills and write the
   * evolution history — all or nothing.
   */
  commitEvolution(
    params: CommitEvolutionParams,
  ): Promise<CommitEvolutionResult>;
  getEvolutionHistory(monsterId: string): Promise<EvolutionHistoryRecord[]>;

  // Wallet (Phase 7)
  getVerifiedWallet(trainerId: string): Promise<string | null>;
  setWalletChallenge(
    trainerId: string,
    challenge: WalletChallenge,
  ): Promise<void>;
  getWalletChallenge(trainerId: string): Promise<WalletChallenge | null>;
  /** Canonicalize + bind; clears the nonce (single use). Rejects rebinding. */
  bindWallet(trainerId: string, walletAddress: string): Promise<string>;

  // NFT mint state machine (Phase 7)
  getMonsterByTokenId(tokenId: string): Promise<Monster | null>;
  /** CAS: OFFCHAIN|MINT_FAILED → MINT_PENDING (returns acquired/confirmed/in-progress). */
  tryAcquireMintLock(monsterId: string): Promise<MintLockResult>;
  setMintSubmitted(monsterId: string, submission: MintSubmission): Promise<void>;
  setMintConfirmed(monsterId: string, tokenId: string, owner: string): Promise<void>;
  setMintFailed(monsterId: string, error: string): Promise<void>;
  /** PENDING → MINT_FAILED (stuck recovery); also clears stale claims. */
  releaseMintLock(monsterId: string): Promise<void>;
  setOwnershipMismatch(monsterId: string, mismatch: boolean): Promise<void>;

  // On-chain evolution jobs (Phase 7)
  createOnchainEvolution(
    monsterId: string,
    input: CreateEvolutionJobInput,
  ): Promise<CreateEvolutionJobResult>;
  getOnchainEvolutionByMonster(
    monsterId: string,
  ): Promise<OnchainEvolutionJob[]>;
  setOnchainEvolutionStatus(
    jobId: string,
    status: OnchainEvolutionStatus,
    patch?: Partial<{
      txHash: string;
      chainId: number;
      contractAddress: string;
      error: string;
      confirmedAt: Date;
      syncedAt: Date;
    }>,
  ): Promise<void>;

  // Ownership sync (Phase 8)
  getTrainerByWallet(walletAddress: string): Promise<string | null>;
  getMonstersByOnchainOwner(walletAddress: string): Promise<Monster[]>;
  setMonsterOwner(
    monsterId: string,
    ownerId: string | null,
    onchainOwnerAddress?: string | null,
  ): Promise<void>;
  removeTeamSlotByMonster(monsterId: string): Promise<void>;

  // Marketplace listings (Phase 8)
  getListingByMonster(monsterId: string): Promise<MarketplaceListingRecord | null>;
  getActiveListingByMonster(monsterId: string): Promise<MarketplaceListingRecord | null>;
  createListing(
    monsterId: string,
    sellerId: string,
    input: CreateListingInput,
  ): Promise<MarketplaceListingRecord>;
  updateListingStatus(id: string, patch: ListingStatusPatch): Promise<void>;
  listActiveListings(): Promise<MarketplaceListingWithMonster[]>;
  listTrainerListings(trainerId: string): Promise<MarketplaceListingWithMonster[]>;

  // ---------- Pixel World (Pixel World Upgrade) ----------
  getWorldSpawns(): Promise<WorldSpawnRecord[]>;
  /**
   * Append new spawns without exceeding the supplied world capacity. The
   * Prisma implementation serializes this short critical section in Postgres.
   */
  saveWorldSpawns(spawns: WorldSpawnRecord[], capacity?: number): Promise<void>;
  deleteExpiredWorldSpawns(now: Date): Promise<number>;
  deleteWorldSpawn(id: string): Promise<void>;
  getTrainerWorldPosition(
    trainerId: string,
  ): Promise<{ worldMap: string; worldX: number; worldY: number } | null>;
  saveTrainerWorldPosition(
    trainerId: string,
    position: { worldMap: string; worldX: number; worldY: number },
  ): Promise<void>;
  getPickupClaims(trainerId: string): Promise<WorldPickupClaimRecord[]>;
  claimPickup(
    trainerId: string,
    pickupKey: string,
    now: Date,
  ): Promise<"claimed" | "cooldown">;
  /** Claim a pickup marker and grant its server-selected reward atomically. */
  claimPickupReward(
    trainerId: string,
    pickupKey: string,
    now: Date,
    cooldownMs: number,
    reward: WorldReward,
  ): Promise<WorldRewardClaimResult>;
  /** atomic shop purchase: gold check + deduct + inventory grant */
  purchaseShopItem(
    trainerId: string,
    itemSlug: string,
    quantity: number,
    unitPrice: number,
  ): Promise<{ ok: true; goldAfter: number } | { ok: false; error: string }>;
  /** one-time starter supply (idempotent) */
  grantStarterSupply(trainerId: string): Promise<boolean>;
  /** add gold (server-authorized rewards: pickups, etc.) */
  addGold(trainerId: string, amount: number): Promise<number>;
  getDailySupplyState(trainerId: string): Promise<{ lastClaimedAt: Date | null }>;
  /** atomic daily supply claim — only one concurrent request wins */
  claimDailySupply(
    trainerId: string,
    now: Date,
  ): Promise<{ ok: true } | { ok: false; error: string }>;
  /** Claim the daily marker and all bundle items in one transaction. */
  claimDailySupplyBundle(
    trainerId: string,
    now: Date,
    items: readonly WorldItemGrant[],
  ): Promise<{ ok: true } | { ok: false; error: string }>;
}

// ---------- Pixel World types ----------

export interface WorldSpawnRecord {
  id: string;
  speciesId: number;
  zoneId: string;
  x: number;
  y: number;
  level: number;
  createdAt: Date;
  expiresAt: Date;
}

export interface WorldPickupClaimRecord {
  id: string;
  trainerId: string;
  pickupKey: string;
  claimedAt: Date;
}

export interface WorldItemGrant {
  itemSlug: string;
  quantity: number;
}

export interface WorldReward {
  itemSlug?: string;
  gold?: number;
  quantity: number;
}

export type WorldRewardClaimResult =
  | { ok: true; goldAfter: number }
  | { ok: false; error: "cooldown" | "unknown-item" | "trainer-not-found" };
