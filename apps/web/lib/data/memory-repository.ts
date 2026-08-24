import { randomId } from "@chainmon/game-engine";
import { getCaptureBall } from "@chainmon/game-engine";
import type { WildEncounter } from "@chainmon/game-engine";
import type {
  BattleLogEntry,
  BattleState,
} from "@chainmon/game-engine";
import { SKILLS } from "@chainmon/monster-data";
import { getAddress } from "viem";
import type {
  MintStatus,
  Monster,
  OnchainEvolutionStatus,
  TrainerProfile,
} from "@chainmon/shared";
import { STARTER_INVENTORY } from "./starter-inventory";
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
  MarketplaceListingWithMonster,
  MintLockResult,
  MintSubmission,
  OnchainEvolutionJob,
  RewardSettleContext,
  SubmitRoundInput,
  SubmitRoundResult,
  WalletChallenge,
  WorldPickupClaimRecord,
  WorldSpawnRecord,
} from "./types";

/**
 * In-memory repository — used when PostgreSQL is unreachable.
 * Data lives in the server process: survives page navigations,
 * resets when the server restarts. Clearly labeled as Demo Mode in the UI.
 * Single-threaded JS gives the same business atomicity as the Prisma
 * transaction path.
 */

interface MemoryBattle {
  id: string;
  trainerId: string;
  state: BattleState;
  logs: BattleLogEntry[];
  playerMonsterIds: string[];
  rewards: BattleRewardSettlement | null;
}

interface MemoryWallet {
  address: string | null;
  nonce: string | null;
  nonceExpiresAt: Date | null;
}

interface MemoryState {
  trainer: TrainerProfile | null;
  monsters: Monster[];
  encounters: WildEncounter[];
  /** trainerId → (itemSlug → quantity) */
  inventory: Map<string, Map<string, number>>;
  /** trainerId → 3 monster ids in slot order */
  team: Map<string, string[]>;
  battles: MemoryBattle[];
  evolutions: EvolutionHistoryRecord[];
  wallet: MemoryWallet;
  onchainEvolutions: OnchainEvolutionJob[];
  listings: MarketplaceListingRecord[];
  /** Pixel World state */
  worldSpawns: WorldSpawnRecord[];
  worldPosition: { worldMap: string; worldX: number; worldY: number };
  pickupClaims: WorldPickupClaimRecord[];
  dailySupplyAt: Date | null;
  starterSupplyClaimed: boolean;
  /** TEST-ONLY: simulates additional trainers bound to wallets (multi-trainer
   *  scenarios like marketplace sales). Never used by production code. */
  walletTestOwners: Map<string, string>;
  /** TEST-ONLY: reverse mapping trainer → wallet for the same scenarios. */
  trainerTestWallets: Map<string, string>;
}

const state: MemoryState = {
  trainer: null,
  monsters: [],
  encounters: [],
  inventory: new Map(),
  team: new Map(),
  battles: [],
  evolutions: [],
  wallet: { address: null, nonce: null, nonceExpiresAt: null },
  onchainEvolutions: [],
  listings: [],
  worldSpawns: [],
  worldPosition: { worldMap: "chainmon-valley", worldX: 30, worldY: 24 },
  pickupClaims: [],
  dailySupplyAt: null,
  starterSupplyClaimed: false,
  walletTestOwners: new Map(),
  trainerTestWallets: new Map(),
};

/** Test helper — clears the in-memory state. */
export function resetMemoryRepository(): void {
  state.trainer = null;
  state.monsters = [];
  state.encounters = [];
  state.inventory = new Map();
  state.team = new Map();
  state.battles = [];
  state.evolutions = [];
  state.wallet = { address: null, nonce: null, nonceExpiresAt: null };
  state.onchainEvolutions = [];
  state.listings = [];
  state.worldSpawns = [];
  state.worldPosition = { worldMap: "chainmon-valley", worldX: 30, worldY: 24 };
  state.pickupClaims = [];
  state.dailySupplyAt = null;
  state.starterSupplyClaimed = false;
  state.walletTestOwners = new Map();
  state.trainerTestWallets = new Map();
}

/**
 * TEST-ONLY helper: simulates a trainer bound to a wallet (multi-trainer
 * marketplace / ownership scenarios). Not used by production code.
 */
export function setMemoryWalletOwnerForTest(
  walletAddress: string,
  trainerId: string,
): void {
  const canonical = walletAddress.toLowerCase();
  state.walletTestOwners.set(canonical, trainerId);
  state.trainerTestWallets.set(trainerId, canonical);
}

/** Transaction-scoped storage primitives over the in-memory state. */
function memoryRewardCtx(trainerId: string): RewardSettleContext {
  return {
    async getMonster(id) {
      const monster = state.monsters.find((m) => m.id === id);
      if (!monster) return null;
      return {
        id: monster.id,
        speciesId: monster.speciesId,
        level: monster.level,
        exp: monster.exp,
        dna: monster.dna,
        skills: monster.skills.map((s) => s.id),
      };
    },
    async setMonsterStats(id, update) {
      const monster = state.monsters.find((m) => m.id === id);
      if (!monster) return;
      monster.level = update.level;
      monster.exp = update.exp;
      monster.hp = update.hp;
      monster.attack = update.attack;
      monster.defense = update.defense;
      monster.speed = update.speed;
    },
    async addMonsterSkills(id, skillIds) {
      const monster = state.monsters.find((m) => m.id === id);
      if (!monster) return [];
      const owned = new Set(monster.skills.map((s) => s.id));
      const added: string[] = [];
      for (const skillId of skillIds) {
        if (monster.skills.length >= 4) break;
        if (owned.has(skillId)) continue;
        const skill = SKILLS.find((s) => s.id === skillId);
        if (!skill) continue;
        monster.skills.push(skill);
        owned.add(skillId);
        added.push(skillId);
      }
      return added;
    },
    async addGold(amount) {
      if (state.trainer && state.trainer.id === trainerId) {
        state.trainer.gold += amount;
      }
    },
    async addInventory(itemSlug, quantity) {
      const bag = state.inventory.get(trainerId);
      if (!bag) return;
      bag.set(itemSlug, (bag.get(itemSlug) ?? 0) + quantity);
    },
  };
}

export const memoryRepository: GameRepository = {
  kind: "memory",

  async getDemoTrainer() {
    return state.trainer;
  },

  async createDemoTrainer(nickname) {
    if (state.trainer) return state.trainer;
    state.trainer = {
      id: randomId(),
      nickname,
      gold: 0,
      wins: 0,
      battleCount: 0,
      captures: 0,
    };
    // Grant the starter inventory exactly once (trainer is created once)
    // and mark it claimed so grantStarterSupply is idempotent.
    state.inventory.set(
      state.trainer.id,
      new Map(Object.entries(STARTER_INVENTORY)),
    );
    state.starterSupplyClaimed = true;
    return state.trainer;
  },

  async addMonster(monster) {
    state.monsters.push(monster);
  },

  async listMonsters() {
    // Collection = monsters of the current demo trainer (owner-filtered).
    return state.trainer
      ? state.monsters.filter((m) => m.owner === state.trainer?.id)
      : [];
  },

  async getMonster(id) {
    return state.monsters.find((m) => m.id === id) ?? null;
  },

  async getMonsterPublic(id) {
    return state.monsters.find((m) => m.id === id) ?? null;
  },

  async createEncounter(encounter) {
    state.encounters.push(encounter);
  },

  async getEncounterById(id) {
    return state.encounters.find((e) => e.id === id) ?? null;
  },

  async getActiveEncounter(trainerId) {
    return (
      state.encounters.find(
        (e) => e.trainerId === trainerId && e.status === "active",
      ) ?? null
    );
  },

  async markEncounterCaptured(id) {
    const encounter = state.encounters.find((e) => e.id === id);
    if (!encounter || encounter.status !== "active") return false;
    encounter.status = "captured";
    encounter.updatedAt = new Date();
    return true;
  },

  async markEncounterFled(id) {
    const encounter = state.encounters.find((e) => e.id === id);
    if (!encounter || encounter.status !== "active") return false;
    encounter.status = "fled";
    encounter.updatedAt = new Date();
    return true;
  },

  async getInventory(trainerId) {
    const bag = state.inventory.get(trainerId);
    if (!bag) return [];
    const entries: InventoryEntry[] = [];
    for (const [slug, quantity] of bag.entries()) {
      entries.push({
        slug,
        quantity,
        name: getCaptureBall(slug)?.name ?? slug,
      });
    }
    return entries;
  },

  async consumeItem(trainerId, itemSlug) {
    const bag = state.inventory.get(trainerId);
    const quantity = bag?.get(itemSlug) ?? 0;
    if (quantity <= 0) return false;
    bag?.set(itemSlug, quantity - 1);
    return true;
  },

  async commitCapture(params: CaptureCommit): Promise<CommitCaptureResult> {
    const { encounterId, trainerId, itemSlug, monster } = params;

    const encounter = state.encounters.find((e) => e.id === encounterId);
    if (
      !encounter ||
      encounter.status !== "active" ||
      encounter.trainerId !== trainerId
    ) {
      return "encounter-invalid";
    }

    const bag = state.inventory.get(trainerId);
    const quantity = bag?.get(itemSlug) ?? 0;
    if (quantity <= 0) {
      return "no-ball";
    }

    // Atomic block: consume ball + create monster + close encounter.
    bag?.set(itemSlug, quantity - 1);
    state.monsters.push(monster);
    encounter.status = "captured";
    encounter.updatedAt = new Date();
    return "captured";
  },

  async saveTeam(trainerId, monsterIds) {
    state.team.set(trainerId, [...monsterIds]);
  },

  async getTeam(trainerId) {
    const ids = state.team.get(trainerId);
    if (!ids || ids.length !== 3) return null;
    const monsters = ids
      .map((id) => state.monsters.find((m) => m.id === id))
      .filter((m): m is Monster => m !== undefined);
    return monsters.length === 3 ? monsters : null;
  },

  async createBattle(battleState, playerMonsterIds) {
    state.battles.push({
      id: battleState.id,
      trainerId: battleState.trainerId,
      state: battleState,
      logs: [],
      playerMonsterIds: [...playerMonsterIds],
      rewards: null,
    });
  },

  async getBattleById(id): Promise<BattleRecord | null> {
    const battle = state.battles.find((b) => b.id === id);
    return battle
      ? { state: battle.state, logs: battle.logs, rewards: battle.rewards }
      : null;
  },

  async getTrainerBattles(trainerId, limit = 10): Promise<BattleSummary[]> {
    return state.battles
      .filter((b) => b.trainerId === trainerId)
      .slice(-limit)
      .reverse()
      .map((b) => ({
        id: b.id,
        status: b.state.status,
        winner: b.state.winner,
        turn: b.state.turn,
        createdAt: b.state.createdAt,
      }));
  },

  async submitRound(input: SubmitRoundInput): Promise<SubmitRoundResult> {
    const battle = state.battles.find((b) => b.id === input.battleId);
    if (!battle) return { status: "not-found" };
    if (battle.state.status !== "active") return { status: "not-active" };
    if (battle.state.turn !== input.expectedTurn) {
      return { status: "invalid-turn" };
    }

    const result = input.resolver(battle.state);
    const completedTransition =
      battle.state.status === "active" && result.state.status === "completed";

    battle.state = result.state;
    battle.logs = [...battle.logs, ...result.logs];

    let rewards: BattleRewardSettlement | null = null;
    if (completedTransition) {
      const trainer = state.trainer;
      if (trainer && trainer.id === battle.trainerId) {
        trainer.battleCount += 1;
        if (result.state.winner === "player") trainer.wins += 1;
      }
      for (const id of battle.playerMonsterIds) {
        const monster = state.monsters.find((m) => m.id === id);
        if (monster) {
          monster.battleCount += 1;
          if (result.state.winner === "player") monster.wins += 1;
        }
      }
      if (input.applyRewards) {
        rewards = await input.applyRewards(
          memoryRewardCtx(battle.trainerId),
          result,
        );
        battle.rewards = rewards;
      }
    }

    return { status: "ok", state: result.state, logs: result.logs, rewards };
  },

  async commitEvolution(
    params: CommitEvolutionParams,
  ): Promise<CommitEvolutionResult> {
    const monster = state.monsters.find((m) => m.id === params.monsterId);
    if (!monster || monster.owner !== params.trainerId) {
      return { status: "invalid" };
    }
    // Duplicate-evolution guard: the species must still be the origin.
    if (monster.speciesId !== params.fromSpeciesId) {
      return { status: "invalid" };
    }

    if (params.consumedItemSlug) {
      const bag = state.inventory.get(params.trainerId);
      const quantity = bag?.get(params.consumedItemSlug) ?? 0;
      if (quantity <= 0) {
        return { status: "no-item" };
      }
      bag?.set(params.consumedItemSlug, quantity - 1);
    }

    // Atomic block: apply the evolved monster + write history.
    monster.speciesId = params.monster.speciesId;
    monster.name = params.monster.name;
    monster.element = params.monster.element;
    monster.rarity = params.monster.rarity;
    monster.hp = params.monster.hp;
    monster.attack = params.monster.attack;
    monster.defense = params.monster.defense;
    monster.speed = params.monster.speed;
    monster.skills = params.monster.skills;

    const history: EvolutionHistoryRecord = {
      id: randomId(),
      monsterId: params.monsterId,
      fromSpeciesId: params.fromSpeciesId,
      toSpeciesId: params.toSpeciesId,
      level: params.level,
      createdAt: new Date(),
    };
    state.evolutions.push(history);
    return { status: "ok", history };
  },

  async getEvolutionHistory(monsterId) {
    return state.evolutions
      .filter((e) => e.monsterId === monsterId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },

  // ---------------- Wallet (Phase 7) ----------------

  async getVerifiedWallet(trainerId?: string) {
    if (trainerId) {
      const testWallet = state.trainerTestWallets.get(trainerId);
      if (testWallet) return testWallet;
    }
    return state.wallet.address;
  },

  async setWalletChallenge(_trainerId, challenge) {
    state.wallet.nonce = challenge.nonce;
    state.wallet.nonceExpiresAt = challenge.expiresAt;
  },

  async getWalletChallenge() {
    if (!state.wallet.nonce || !state.wallet.nonceExpiresAt) return null;
    return { nonce: state.wallet.nonce, expiresAt: state.wallet.nonceExpiresAt };
  },

  async bindWallet(_trainerId, walletAddress) {
    // Canonical representation: checksum-validated, stored lowercase.
    const canonical = getAddress(walletAddress).toLowerCase();
    if (state.wallet.address && state.wallet.address !== canonical) {
      throw new Error("Wallet rebinding is not supported yet.");
    }
    state.wallet.address = canonical;
    state.wallet.nonce = null;
    state.wallet.nonceExpiresAt = null;
    return canonical;
  },

  // ---------------- NFT mint state machine (Phase 7) ----------------

  async getMonsterByTokenId(tokenId) {
    return state.monsters.find((m) => m.tokenId === tokenId) ?? null;
  },

  async tryAcquireMintLock(monsterId): Promise<MintLockResult> {
    const monster = state.monsters.find((m) => m.id === monsterId);
    if (!monster) return "in-progress";
    const status = monster.mintStatus ?? "OFFCHAIN";
    if (status === "MINT_CONFIRMED") return "confirmed";
    if (status === "MINT_PENDING" || status === "MINT_SUBMITTED") {
      return "in-progress";
    }
    monster.mintStatus = "MINT_PENDING";
    monster.mintError = undefined;
    monster.mintUpdatedAt = new Date();
    return "acquired";
  },

  async setMintSubmitted(monsterId, submission: MintSubmission) {
    const monster = state.monsters.find((m) => m.id === monsterId);
    if (!monster) return;
    monster.mintStatus = "MINT_SUBMITTED";
    monster.mintTxHash = submission.txHash;
    monster.mintChainId = submission.chainId;
    monster.mintContractAddress = submission.contractAddress;
    monster.mintRecipient = submission.recipient;
    monster.mintSubmittedAt = new Date();
    monster.mintUpdatedAt = new Date();
  },

  async setMintConfirmed(monsterId, tokenId, owner) {
    const monster = state.monsters.find((m) => m.id === monsterId);
    if (!monster) return;
    monster.mintStatus = "MINT_CONFIRMED";
    monster.tokenId = tokenId;
    monster.mintRecipient = owner;
    monster.mintError = undefined;
    monster.mintConfirmedAt = new Date();
    monster.mintUpdatedAt = new Date();
  },

  async setMintFailed(monsterId, error) {
    const monster = state.monsters.find((m) => m.id === monsterId);
    if (!monster) return;
    monster.mintStatus = "MINT_FAILED";
    monster.mintError = error;
    monster.mintUpdatedAt = new Date();
  },

  async releaseMintLock(monsterId) {
    const monster = state.monsters.find((m) => m.id === monsterId);
    if (!monster || monster.mintStatus !== "MINT_PENDING") return;
    monster.mintStatus = "MINT_FAILED";
    monster.mintError = "Mint attempt was interrupted; please retry.";
    monster.mintUpdatedAt = new Date();
  },

  async setOwnershipMismatch(monsterId, mismatch) {
    const monster = state.monsters.find((m) => m.id === monsterId);
    if (!monster) return;
    monster.ownershipMismatch = mismatch;
  },

  // ---------------- On-chain evolution jobs (Phase 7) ----------------

  async createOnchainEvolution(
    monsterId,
    input: CreateEvolutionJobInput,
  ): Promise<CreateEvolutionJobResult> {
    const inProgress = state.onchainEvolutions.find(
      (job) =>
        job.monsterId === monsterId &&
        ["EVOLUTION_PENDING", "EVOLUTION_SUBMITTED", "CHAIN_CONFIRMED"].includes(
          job.status,
        ),
    );
    if (inProgress) return { status: "in-progress", job: inProgress };
    const job: OnchainEvolutionJob = {
      id: randomId(),
      monsterId,
      fromSpeciesId: input.fromSpeciesId,
      toSpeciesId: input.toSpeciesId,
      fromStage: input.fromStage,
      toStage: input.toStage,
      status: "EVOLUTION_PENDING",
      createdAt: new Date(),
    };
    state.onchainEvolutions.push(job);
    return { status: "created", job };
  },

  async getOnchainEvolutionByMonster(monsterId) {
    return state.onchainEvolutions
      .filter((job) => job.monsterId === monsterId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async setOnchainEvolutionStatus(jobId, status, patch = {}) {
    const job = state.onchainEvolutions.find((j) => j.id === jobId);
    if (!job) return;
    job.status = status;
    if (patch.txHash !== undefined) job.txHash = patch.txHash;
    if (patch.chainId !== undefined) job.chainId = patch.chainId;
    if (patch.contractAddress !== undefined) {
      job.contractAddress = patch.contractAddress;
    }
    if (patch.error !== undefined) job.error = patch.error;
    if (patch.confirmedAt !== undefined) job.confirmedAt = patch.confirmedAt;
    if (patch.syncedAt !== undefined) job.syncedAt = patch.syncedAt;
  },

  // ---------------- Ownership sync (Phase 8) ----------------

  async getTrainerByWallet(walletAddress) {
    const canonical = getAddress(walletAddress).toLowerCase();
    const testOwner = state.walletTestOwners.get(canonical);
    if (testOwner) return testOwner;
    if (!state.wallet.address || !state.trainer) return null;
    return state.wallet.address === canonical ? state.trainer.id : null;
  },

  async getMonstersByOnchainOwner(walletAddress) {
    const canonical = getAddress(walletAddress).toLowerCase();
    return state.monsters.filter(
      (m) =>
        m.mintStatus === "MINT_CONFIRMED" &&
        m.onchainOwnerAddress === canonical,
    );
  },

  async setMonsterOwner(monsterId, ownerId, onchainOwnerAddress = null) {
    const monster = state.monsters.find((m) => m.id === monsterId);
    if (!monster) return;
    monster.owner = ownerId;
    if (onchainOwnerAddress !== null) {
      monster.onchainOwnerAddress = onchainOwnerAddress;
    } else if (ownerId === null) {
      monster.onchainOwnerAddress = undefined;
    }
    monster.ownershipMismatch = false;
    // Remove the monster from any stale team slot.
    for (const [trainerId, ids] of state.team.entries()) {
      if (ids.includes(monsterId)) {
        state.team.set(
          trainerId,
          ids.filter((id) => id !== monsterId),
        );
      }
    }
  },

  async removeTeamSlotByMonster(monsterId) {
    for (const [trainerId, ids] of state.team.entries()) {
      if (ids.includes(monsterId)) {
        state.team.set(
          trainerId,
          ids.filter((id) => id !== monsterId),
        );
      }
    }
  },

  // ---------------- Marketplace listings (Phase 8) ----------------

  async getListingByMonster(monsterId) {
    return state.listings.find((l) => l.monsterId === monsterId) ?? null;
  },

  async getActiveListingByMonster(monsterId) {
    return (
      state.listings.find(
        (l) => l.monsterId === monsterId && l.status === "ACTIVE",
      ) ?? null
    );
  },

  async createListing(monsterId, sellerId, input: CreateListingInput) {
    const now = new Date();
    const record: MarketplaceListingRecord = {
      id: randomId(),
      monsterId,
      sellerId,
      tokenId: input.tokenId,
      priceWei: input.priceWei,
      currency: "ETH",
      status: "PENDING",
      chainId: input.chainId,
      nftContractAddress: input.nftContractAddress,
      marketplaceAddress: input.marketplaceAddress,
      createdAt: now,
      updatedAt: now,
    };
    state.listings.push(record);
    return record;
  },

  async updateListingStatus(id, patch: ListingStatusPatch) {
    const listing = state.listings.find((l) => l.id === id);
    if (!listing) return;
    listing.status = patch.status;
    if (patch.txHash !== undefined) {
      if (patch.status === "ACTIVE" || patch.status === "PENDING") {
        listing.listingTxHash = patch.txHash;
      } else if (patch.status === "CANCELLED" || patch.status === "CANCEL_PENDING") {
        listing.cancelTxHash = patch.txHash;
      } else {
        listing.saleTxHash = patch.txHash;
      }
    }
    if (patch.buyerWallet !== undefined) listing.buyerWallet = patch.buyerWallet;
    if (patch.soldAt !== undefined) listing.soldAt = patch.soldAt;
    if (patch.cancelAt !== undefined) listing.cancelAt = patch.cancelAt;
    listing.updatedAt = new Date();
  },

  async listActiveListings(): Promise<MarketplaceListingWithMonster[]> {
    return state.listings
      .filter((l) => l.status === "ACTIVE")
      .map((l) => {
        const monster = state.monsters.find((m) => m.id === l.monsterId);
        return monster ? { ...l, monster } : null;
      })
      .filter((l): l is MarketplaceListingWithMonster => l !== null);
  },

  async listTrainerListings(trainerId): Promise<MarketplaceListingWithMonster[]> {
    return state.listings
      .filter((l) => l.sellerId === trainerId)
      .map((l) => {
        const monster = state.monsters.find((m) => m.id === l.monsterId);
        return monster ? { ...l, monster } : null;
      })
      .filter((l): l is MarketplaceListingWithMonster => l !== null);
  },

  // ---------------- Pixel World ----------------

  async getWorldSpawns(): Promise<WorldSpawnRecord[]> {
    return [...state.worldSpawns];
  },

  async saveWorldSpawns(spawns: WorldSpawnRecord[], capacity = Number.POSITIVE_INFINITY): Promise<void> {
    for (const s of spawns) {
      if (state.worldSpawns.length >= capacity) break;
      if (!state.worldSpawns.some((e) => e.id === s.id)) {
        state.worldSpawns.push(s);
      }
    }
  },

  async deleteExpiredWorldSpawns(now: Date): Promise<number> {
    const before = state.worldSpawns.length;
    state.worldSpawns = state.worldSpawns.filter((s) => s.expiresAt > now);
    return before - state.worldSpawns.length;
  },

  async deleteWorldSpawn(id: string): Promise<void> {
    state.worldSpawns = state.worldSpawns.filter((s) => s.id !== id);
  },

  async getTrainerWorldPosition(): Promise<{ worldMap: string; worldX: number; worldY: number } | null> {
    return state.trainer ? { ...state.worldPosition } : null;
  },

  async saveTrainerWorldPosition(
    _trainerId: string,
    position: { worldMap: string; worldX: number; worldY: number },
  ): Promise<void> {
    state.worldPosition = position;
  },

  async getPickupClaims(_trainerId: string): Promise<WorldPickupClaimRecord[]> {
    return [...state.pickupClaims];
  },

  async claimPickup(trainerId: string, pickupKey: string, now: Date): Promise<"claimed" | "cooldown"> {
    const existing = state.pickupClaims.find(
      (c) => c.trainerId === trainerId && c.pickupKey === pickupKey,
    );
    if (existing) return "cooldown";
    state.pickupClaims.push({
      id: randomId(),
      trainerId,
      pickupKey,
      claimedAt: now,
    });
    return "claimed";
  },

  async claimPickupReward(trainerId, pickupKey, now, cooldownMs, reward) {
    const existing = state.pickupClaims.find(
      (c) => c.trainerId === trainerId && c.pickupKey === pickupKey,
    );
    if (existing && now.getTime() - existing.claimedAt.getTime() < cooldownMs) {
      return { ok: false as const, error: "cooldown" as const };
    }
    const trainer = state.trainer;
    if (!trainer || trainer.id !== trainerId) {
      return { ok: false as const, error: "trainer-not-found" as const };
    }
    if (reward.itemSlug && !(state.inventory.get(trainerId)?.has(reward.itemSlug))) {
      return { ok: false as const, error: "unknown-item" as const };
    }

    if (existing) existing.claimedAt = now;
    else state.pickupClaims.push({ id: `pickup-${pickupKey}`, trainerId, pickupKey, claimedAt: now });

    if (reward.itemSlug) {
      const bag = state.inventory.get(trainerId)!;
      bag.set(reward.itemSlug, (bag.get(reward.itemSlug) ?? 0) + reward.quantity);
    }
    if (reward.gold) trainer.gold += reward.gold;
    return { ok: true as const, goldAfter: trainer.gold };
  },

  async purchaseShopItem(
    trainerId: string,
    itemSlug: string,
    quantity: number,
    unitPrice: number,
  ): Promise<{ ok: true; goldAfter: number } | { ok: false; error: string }> {
    if (!state.trainer || state.trainer.id !== trainerId) {
      return { ok: false, error: "Trainer not found." };
    }
    const cost = unitPrice * quantity;
    if (state.trainer.gold < cost) {
      return { ok: false, error: "Not enough gold." };
    }
    state.trainer.gold -= cost;
    const bag = state.inventory.get(trainerId) ?? new Map<string, number>();
    bag.set(itemSlug, (bag.get(itemSlug) ?? 0) + quantity);
    state.inventory.set(trainerId, bag);
    return { ok: true, goldAfter: state.trainer.gold };
  },

  async grantStarterSupply(trainerId: string): Promise<boolean> {
    if (state.starterSupplyClaimed) return false;
    const bag = state.inventory.get(trainerId) ?? new Map<string, number>();
    for (const [slug, qty] of Object.entries(STARTER_INVENTORY)) {
      bag.set(slug, (bag.get(slug) ?? 0) + qty);
    }
    state.inventory.set(trainerId, bag);
    state.starterSupplyClaimed = true;
    return true;
  },

  async addGold(trainerId: string, amount: number): Promise<number> {
    if (!state.trainer || state.trainer.id !== trainerId) return 0;
    state.trainer.gold += amount;
    return state.trainer.gold;
  },

  async getDailySupplyState(): Promise<{ lastClaimedAt: Date | null }> {
    return { lastClaimedAt: state.dailySupplyAt };
  },

  async claimDailySupply(
    _trainerId: string,
    now: Date,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if (
      state.dailySupplyAt &&
      now.getTime() - state.dailySupplyAt.getTime() < 24 * 60 * 60 * 1000
    ) {
      return { ok: false, error: "Daily supply already claimed." };
    }
    state.dailySupplyAt = now;
    return { ok: true };
  },

  async claimDailySupplyBundle(trainerId, now, items) {
    if (!state.trainer || state.trainer.id !== trainerId) {
      return { ok: false as const, error: "Trainer not found." };
    }
    if (
      state.dailySupplyAt &&
      now.getTime() - state.dailySupplyAt.getTime() < 24 * 60 * 60 * 1000
    ) {
      return { ok: false as const, error: "Daily supply already claimed." };
    }
    const bag = state.inventory.get(trainerId);
    if (!bag || items.some((item) => !bag.has(item.itemSlug))) {
      return { ok: false as const, error: "Daily supply item is unavailable." };
    }
    state.dailySupplyAt = now;
    for (const item of items) {
      bag.set(item.itemSlug, (bag.get(item.itemSlug) ?? 0) + item.quantity);
    }
    return { ok: true as const };
  },
};
