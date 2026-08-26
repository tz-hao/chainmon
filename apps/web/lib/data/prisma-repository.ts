import { Prisma } from "@prisma/client";
import { generateMonster, getCaptureBall, type WildEncounter } from "@chainmon/game-engine";
import type {
  BattleLogEntry,
  BattleState,
  BattleStatus,
  BattleWinner,
} from "@chainmon/game-engine";
import {
  getSpeciesBySlug,
  getSpeciesById,
  SKILLS,
  STARTER_SPECIES_SLUGS,
} from "@chainmon/monster-data";
import type {
  MintStatus,
  Monster,
  MonsterDNA,
  OnchainEvolutionStatus,
  TrainerProfile,
} from "@chainmon/shared";
import { getAddress } from "viem";
import { prisma } from "@/lib/prisma";
import { DEMO_WALLET_ADDRESS } from "./demo";
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
  WorldPickupClaimRecord,
  WorldSpawnRecord,
} from "./types";

class CaptureRaceLost extends Error {
  constructor() {
    super("Capture encounter is no longer active.");
  }
}

async function getUserForTrainer(trainerId: string) {
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    include: { user: true },
  });
  return trainer?.user ?? null;
}

function generatedTrainerNickname(walletAddress: string): string {
  const compact = walletAddress.slice(-8).toUpperCase();
  return `Trainer-${compact || "NEW"}`;
}

const ELEMENT_TO_SHARED: Record<string, Monster["element"]> = {
  FIRE: "fire",
  WATER: "water",
  NATURE: "nature",
  ELECTRIC: "electric",
};

const RARITY_TO_SHARED: Record<string, Monster["rarity"]> = {
  COMMON: "common",
  RARE: "rare",
  EPIC: "epic",
  LEGENDARY: "legendary",
};

const ENCOUNTER_STATUS_TO_PRISMA = {
  active: "ACTIVE",
  captured: "CAPTURED",
  fled: "FLED",
} as const;

const ENCOUNTER_STATUS_TO_SHARED = {
  ACTIVE: "active",
  CAPTURED: "captured",
  FLED: "fled",
} as const;

function toTrainerProfile(row: {
  id: string;
  nickname: string;
  gold: number;
  wins: number;
  battleCount: number;
  captures: number;
}): TrainerProfile {
  return {
    id: row.id,
    nickname: row.nickname,
    gold: row.gold,
    wins: row.wins,
    battleCount: row.battleCount,
    captures: row.captures,
  };
}

function parseDna(raw: unknown): MonsterDNA {
  const record = (raw ?? {}) as Partial<Record<keyof MonsterDNA, unknown>>;
  return {
    hpGene: Number(record.hpGene ?? 0),
    attackGene: Number(record.attackGene ?? 0),
    defenseGene: Number(record.defenseGene ?? 0),
    speedGene: Number(record.speedGene ?? 0),
    mutationGene: Number(record.mutationGene ?? 0),
  };
}

function toMonster(row: {
  id: string;
  tokenId: string | null;
  speciesId: number;
  name: string;
  level: number;
  exp: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  dna: unknown;
  generation: number;
  battleCount: number;
  wins: number;
  ownerId?: string | null;
  onchainOwnerAddress?: string | null;
  skills?: { skill: { name: string } }[];
  mintStatus?: string | null;
  mintTxHash?: string | null;
  mintChainId?: number | null;
  mintContractAddress?: string | null;
  mintRecipient?: string | null;
  mintError?: string | null;
  mintSubmittedAt?: Date | null;
  mintConfirmedAt?: Date | null;
  ownershipMismatch?: boolean | null;
}): Monster {
  const species = getSpeciesById(row.speciesId);
  const skills = (row.skills ?? [])
    .map((link) => SKILLS.find((s) => s.name === link.skill.name))
    .filter((skill): skill is NonNullable<typeof skill> => skill !== undefined);

  return {
    id: row.id,
    tokenId: row.tokenId ?? undefined,
    speciesId: row.speciesId,
    name: row.name,
    element: species?.element ?? ELEMENT_TO_SHARED.FIRE,
    rarity: species?.rarity ?? RARITY_TO_SHARED.COMMON,
    level: row.level,
    exp: row.exp,
    hp: row.hp,
    attack: row.attack,
    defense: row.defense,
    speed: row.speed,
    skills,
    owner: row.ownerId ?? null,
    onchainOwnerAddress: row.onchainOwnerAddress ?? undefined,
    generation: row.generation,
    battleCount: row.battleCount,
    wins: row.wins,
    dna: parseDna(row.dna),
    mintStatus: (row.mintStatus as MintStatus | null | undefined) ?? "OFFCHAIN",
    mintTxHash: row.mintTxHash ?? undefined,
    mintChainId: row.mintChainId ?? undefined,
    mintContractAddress: row.mintContractAddress ?? undefined,
    mintRecipient: row.mintRecipient ?? undefined,
    mintError: row.mintError ?? undefined,
    mintSubmittedAt: row.mintSubmittedAt ?? undefined,
    mintConfirmedAt: row.mintConfirmedAt ?? undefined,
    ownershipMismatch: row.ownershipMismatch ?? false,
  };
}

type EncounterRow = {
  id: string;
  trainerId: string;
  regionId: string;
  speciesId: number;
  currentHp: number;
  maxHp: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  species: { name: string; element: string; rarity: string };
};

function toEncounter(row: EncounterRow): WildEncounter {
  return {
    id: row.id,
    trainerId: row.trainerId,
    regionId: row.regionId,
    speciesId: row.speciesId,
    speciesName: row.species.name,
    element: ELEMENT_TO_SHARED[row.species.element] ?? "fire",
    rarity: RARITY_TO_SHARED[row.species.rarity] ?? "common",
    level: 1, // Phase 3: encounters are always level 1
    currentHp: row.currentHp,
    maxHp: row.maxHp,
    status:
      ENCOUNTER_STATUS_TO_SHARED[
        row.status as keyof typeof ENCOUNTER_STATUS_TO_SHARED
      ] ?? "active",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const monsterInclude = {
  skills: { include: { skill: true } },
} satisfies Prisma.MonsterInclude;

const encounterInclude = {
  species: true,
} satisfies Prisma.EncounterInclude;

function toListing(row: {
  id: string;
  monsterId: string;
  sellerId: string;
  tokenId: string | null;
  priceWei: bigint;
  currency: string;
  status: string;
  chainId: number | null;
  nftContractAddress: string | null;
  marketplaceAddress: string | null;
  listingTxHash: string | null;
  cancelTxHash: string | null;
  saleTxHash: string | null;
  buyerWallet: string | null;
  createdAt: Date;
  updatedAt: Date;
  soldAt: Date | null;
  cancelAt: Date | null;
}): MarketplaceListingRecord {
  return {
    id: row.id,
    monsterId: row.monsterId,
    sellerId: row.sellerId,
    tokenId: row.tokenId ?? undefined,
    priceWei: row.priceWei.toString(), // BigInt → string (JSON-safe)
    currency: row.currency,
    status: row.status as MarketplaceListingStatus,
    chainId: row.chainId ?? undefined,
    nftContractAddress: row.nftContractAddress ?? undefined,
    marketplaceAddress: row.marketplaceAddress ?? undefined,
    listingTxHash: row.listingTxHash ?? undefined,
    cancelTxHash: row.cancelTxHash ?? undefined,
    saleTxHash: row.saleTxHash ?? undefined,
    buyerWallet: row.buyerWallet ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    soldAt: row.soldAt ?? undefined,
    cancelAt: row.cancelAt ?? undefined,
  };
}

function toEvolutionJob(row: {
  id: string;
  monsterId: string;
  fromSpeciesId: number;
  toSpeciesId: number;
  fromStage: number;
  toStage: number;
  status: string;
  txHash: string | null;
  chainId: number | null;
  contractAddress: string | null;
  error: string | null;
  createdAt: Date;
  submittedAt: Date | null;
  confirmedAt: Date | null;
  syncedAt: Date | null;
}): OnchainEvolutionJob {
  return {
    id: row.id,
    monsterId: row.monsterId,
    fromSpeciesId: row.fromSpeciesId,
    toSpeciesId: row.toSpeciesId,
    fromStage: row.fromStage,
    toStage: row.toStage,
    status: row.status as OnchainEvolutionStatus,
    txHash: row.txHash ?? undefined,
    chainId: row.chainId ?? undefined,
    contractAddress: row.contractAddress ?? undefined,
    error: row.error ?? undefined,
    createdAt: row.createdAt,
    submittedAt: row.submittedAt ?? undefined,
    confirmedAt: row.confirmedAt ?? undefined,
    syncedAt: row.syncedAt ?? undefined,
  };
}

/** Grant the starter balls once per trainer (idempotent). */
async function ensureStarterInventory(trainerId: string): Promise<void> {
  const existing = await prisma.inventory.count({ where: { trainerId } });
  if (existing > 0) return;
  const items = await prisma.item.findMany({
    where: { slug: { in: Object.keys(STARTER_INVENTORY) } },
  });
  if (items.length === 0) return; // items not seeded yet — nothing to grant
  await prisma.inventory.createMany({
    data: items.map((item) => ({
      trainerId,
      itemId: item.id,
      quantity: STARTER_INVENTORY[item.slug] ?? 0,
    })),
  });
}

async function skillLinksFor(
  tx: Prisma.TransactionClient,
  monster: Monster,
): Promise<{ skillId: number; slot: number }[]> {
  const names = monster.skills.map((s) => s.name);
  const skillRows =
    names.length > 0
      ? await tx.skill.findMany({ where: { name: { in: names } } })
      : [];
  const skillIdByName = new Map(skillRows.map((row) => [row.name, row.id]));
  const links: { skillId: number; slot: number }[] = [];
  monster.skills.forEach((skill, index) => {
    const skillId = skillIdByName.get(skill.name);
    if (skillId !== undefined) {
      links.push({ skillId, slot: index });
    }
  });
  return links;
}

/** Transaction-scoped storage primitives over a Prisma transaction client. */
function prismaRewardCtx(
  tx: Prisma.TransactionClient,
  trainerId: string,
): RewardSettleContext {
  return {
    async getMonster(id): Promise<MonsterStateView | null> {
      const row = await tx.monster.findUnique({
        where: { id },
        include: { skills: { include: { skill: true } } },
      });
      if (!row) return null;
      return {
        id: row.id,
        speciesId: row.speciesId,
        level: row.level,
        exp: row.exp,
        dna: parseDna(row.dna),
        skills: row.skills
          .map((link) => SKILLS.find((s) => s.name === link.skill.name)?.id)
          .filter((id): id is string => id !== undefined),
      };
    },
    async setMonsterStats(id, update: MonsterStatsUpdate) {
      await tx.monster.update({
        where: { id },
        data: {
          level: update.level,
          exp: update.exp,
          hp: update.hp,
          attack: update.attack,
          defense: update.defense,
          speed: update.speed,
        },
      });
    },
    async addMonsterSkills(id, skillIds) {
      const existing = await tx.monsterSkill.count({ where: { monsterId: id } });
      const capacity = Math.max(0, 4 - existing);
      const added: string[] = [];
      let slot = existing;
      for (const skillId of skillIds.slice(0, capacity)) {
        const skill = SKILLS.find((s) => s.id === skillId);
        if (!skill) continue;
        const row = await tx.skill.findUnique({ where: { name: skill.name } });
        if (!row) continue;
        const exists = await tx.monsterSkill.findUnique({
          where: { monsterId_skillId: { monsterId: id, skillId: row.id } },
        });
        if (exists) continue;
        await tx.monsterSkill.create({
          data: { monsterId: id, skillId: row.id, slot },
        });
        slot += 1;
        added.push(skillId);
      }
      return added;
    },
    async addGold(amount) {
      await tx.trainer.update({
        where: { id: trainerId },
        data: { gold: { increment: amount } },
      });
    },
    async addInventory(itemSlug, quantity) {
      const item = await tx.item.findUnique({ where: { slug: itemSlug } });
      if (!item) return;
      await tx.inventory.upsert({
        where: { trainerId_itemId: { trainerId, itemId: item.id } },
        update: { quantity: { increment: quantity } },
        create: { trainerId, itemId: item.id, quantity },
      });
    },
  };
}

export const prismaRepository: GameRepository = {
  kind: "prisma",

  async getTrainerById(trainerId) {
    const trainer = await prisma.trainer.findUnique({ where: { id: trainerId } });
    return trainer ? toTrainerProfile(trainer) : null;
  },

  async getTrainerByWallet(walletAddress) {
    const canonical = getAddress(walletAddress).toLowerCase();
    const user = await prisma.user.findUnique({
      where: { walletAddress: canonical },
      include: { trainer: true },
    });
    return user?.trainer?.id ?? null;
  },

  async upsertWalletPlayer(walletAddress: string): Promise<WalletPlayerResult> {
    const canonicalWalletAddress = getAddress(walletAddress).toLowerCase();
    const user = await prisma.user.upsert({
      where: { walletAddress: canonicalWalletAddress },
      update: { walletVerifiedAt: new Date() },
      create: {
        walletAddress: canonicalWalletAddress,
        walletVerifiedAt: new Date(),
      },
    });

    const existingTrainer = await prisma.trainer.findUnique({
      where: { userId: user.id },
    });
    if (existingTrainer) {
      return { trainer: toTrainerProfile(existingTrainer), created: false };
    }

    const baseNickname = generatedTrainerNickname(canonicalWalletAddress);
    let nickname = baseNickname;
    for (let suffix = 1; suffix <= 100; suffix += 1) {
      const collision = await prisma.trainer.findUnique({ where: { nickname } });
      if (!collision) break;
      nickname = `${baseNickname}-${suffix}`;
      if (suffix === 100) {
        throw new Error("Could not allocate a trainer nickname. Please try again.");
      }
    }
    try {
      const trainer = await prisma.trainer.create({
        data: { userId: user.id, nickname },
      });
      return { trainer: toTrainerProfile(trainer), created: true };
    } catch (error) {
      // Wallet logins can race. The unique Trainer.userId constraint is the
      // source of truth: re-read it rather than ever creating a second trainer.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const racedTrainer = await prisma.trainer.findUnique({ where: { userId: user.id } });
        if (racedTrainer) return { trainer: toTrainerProfile(racedTrainer), created: false };
      }
      throw error;
    }
  },

  async createWalletLoginChallenge(challenge: WalletLoginChallenge) {
    await prisma.walletLoginChallenge.create({
      data: {
        id: challenge.id,
        address: getAddress(challenge.address).toLowerCase(),
        nonce: challenge.nonce,
        message: challenge.message,
        expiresAt: challenge.expiresAt,
      },
    });
  },

  async getWalletLoginChallenge(nonce: string) {
    const row = await prisma.walletLoginChallenge.findUnique({ where: { nonce } });
    return row
      ? {
          id: row.id,
          address: row.address,
          nonce: row.nonce,
          message: row.message,
          expiresAt: row.expiresAt,
        }
      : null;
  },

  async consumeWalletLoginChallenge(id: string, now: Date) {
    const result = await prisma.walletLoginChallenge.updateMany({
      where: { id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    return result.count === 1;
  },

  async grantStarterMonster(trainerId) {
    const starter = getSpeciesBySlug(STARTER_SPECIES_SLUGS[0]);
    if (!starter) throw new Error("Starter species registry is unavailable.");
    return prisma.$transaction(async (tx) => {
      const claim = await tx.trainer.updateMany({
        where: { id: trainerId, starterMonsterClaimed: false },
        data: { starterMonsterClaimed: true },
      });
      if (claim.count === 0) return false;
      const monster = generateMonster(starter, { owner: trainerId });
      const links = await skillLinksFor(tx, monster);
      await tx.monster.create({
        data: {
          id: monster.id,
          speciesId: monster.speciesId,
          name: monster.name,
          level: monster.level,
          exp: monster.exp,
          hp: monster.hp,
          attack: monster.attack,
          defense: monster.defense,
          speed: monster.speed,
          dna: monster.dna as unknown as Prisma.InputJsonValue,
          generation: monster.generation,
          battleCount: monster.battleCount,
          wins: monster.wins,
          ownerId: trainerId,
          skills: { create: links },
        },
      });
      return true;
    });
  },

  async getDemoTrainer() {
    const user = await prisma.user.findUnique({
      where: { walletAddress: DEMO_WALLET_ADDRESS },
      include: { trainer: true },
    });
    return user?.trainer ? toTrainerProfile(user.trainer) : null;
  },

  async createDemoTrainer(nickname) {
    const user = await prisma.user.upsert({
      where: { walletAddress: DEMO_WALLET_ADDRESS },
      update: { walletVerifiedAt: new Date() },
      create: { walletAddress: DEMO_WALLET_ADDRESS, walletVerifiedAt: new Date() },
    });
    const trainer = await prisma.trainer.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, nickname },
    });
    await ensureStarterInventory(trainer.id);
    return toTrainerProfile(trainer);
  },

  async bindWallet(trainerId: string, walletAddress: string): Promise<string> {
    const canonical = getAddress(walletAddress).toLowerCase();
    const user = await getUserForTrainer(trainerId);
    if (!user) throw new Error("Trainer not found.");
    await prisma.user.update({
      where: { id: user.id },
      data: { walletAddress: canonical, walletVerifiedAt: new Date() },
    });
    return canonical;
  },

  async addMonster(monster) {
    if (!monster.owner) {
      throw new Error("A monster owner is required.");
    }
    const links = await skillLinksFor(prisma, monster);
    await prisma.monster.create({
      data: {
        id: monster.id,
        speciesId: monster.speciesId,
        name: monster.name,
        level: monster.level,
        exp: monster.exp,
        hp: monster.hp,
        attack: monster.attack,
        defense: monster.defense,
        speed: monster.speed,
        dna: monster.dna as unknown as Prisma.InputJsonValue,
        generation: monster.generation,
        battleCount: monster.battleCount,
        wins: monster.wins,
        ownerId: monster.owner,
        skills: { create: links },
      },
    });
  },

  async listMonsters(trainerId?: string) {
    const trainer = trainerId ? await this.getTrainerById(trainerId) : null;
    if (!trainer) return [];
    const rows = await prisma.monster.findMany({
      where: { ownerId: trainer.id },
      orderBy: { createdAt: "asc" },
      include: monsterInclude,
    });
    return rows.map(toMonster);
  },

  async getMonster(id, trainerId?: string) {
    const trainer = trainerId ? await this.getTrainerById(trainerId) : null;
    if (!trainer) return null;
    const row = await prisma.monster.findFirst({
      where: { id, ownerId: trainer.id },
      include: monsterInclude,
    });
    return row ? toMonster(row) : null;
  },

  async getMonsterPublic(id) {
    const row = await prisma.monster.findUnique({
      where: { id },
      include: monsterInclude,
    });
    return row ? toMonster(row) : null;
  },

  async createEncounter(encounter) {
    await prisma.encounter.create({
      data: {
        id: encounter.id,
        trainerId: encounter.trainerId,
        regionId: encounter.regionId,
        speciesId: encounter.speciesId,
        currentHp: encounter.currentHp,
        maxHp: encounter.maxHp,
        status: ENCOUNTER_STATUS_TO_PRISMA[encounter.status],
      },
    });
  },

  async getEncounterById(id) {
    const row = await prisma.encounter.findUnique({
      where: { id },
      include: encounterInclude,
    });
    return row ? toEncounter(row) : null;
  },

  async getActiveEncounter(trainerId) {
    const row = await prisma.encounter.findFirst({
      where: { trainerId, status: "ACTIVE" },
      include: encounterInclude,
    });
    return row ? toEncounter(row) : null;
  },

  async markEncounterCaptured(id) {
    const result = await prisma.encounter.updateMany({
      where: { id, status: "ACTIVE" },
      data: { status: "CAPTURED" },
    });
    return result.count > 0;
  },

  async markEncounterFled(id) {
    const result = await prisma.encounter.updateMany({
      where: { id, status: "ACTIVE" },
      data: { status: "FLED" },
    });
    return result.count > 0;
  },

  async getInventory(trainerId) {
    const rows = await prisma.inventory.findMany({
      where: { trainerId },
      include: { item: true },
    });
    const entries: InventoryEntry[] = [];
    for (const row of rows) {
      const name =
        getCaptureBall(row.item.slug)?.name ?? row.item.name ?? row.item.slug;
      entries.push({ slug: row.item.slug, name, quantity: row.quantity });
    }
    return entries;
  },

  async consumeItem(trainerId, itemSlug) {
    const item = await prisma.item.findUnique({ where: { slug: itemSlug } });
    if (!item) return false;
    const result = await prisma.inventory.updateMany({
      where: { trainerId, itemId: item.id, quantity: { gt: 0 } },
      data: { quantity: { decrement: 1 } },
    });
    return result.count > 0;
  },

  async commitCapture(params: CaptureCommit): Promise<CommitCaptureResult> {
    const { encounterId, trainerId, itemSlug, monster } = params;

    try {
      return await prisma.$transaction(async (tx) => {
        const item = await tx.item.findUnique({ where: { slug: itemSlug } });
        if (!item) return "no-ball" as const;

        // Spend first, then acquire the encounter through an ACTIVE CAS. A
        // losing concurrent transaction throws so this decrement is rolled
        // back together with every other write.
        const consumed = await tx.inventory.updateMany({
          where: { trainerId, itemId: item.id, quantity: { gt: 0 } },
          data: { quantity: { decrement: 1 } },
        });
        if (consumed.count === 0) return "no-ball" as const;

        const captured = await tx.encounter.updateMany({
          where: { id: encounterId, trainerId, status: "ACTIVE" },
          data: { status: "CAPTURED" },
        });
        if (captured.count !== 1) throw new CaptureRaceLost();

        const links = await skillLinksFor(tx, monster);
        await tx.monster.create({
          data: {
            id: monster.id,
            speciesId: monster.speciesId,
            name: monster.name,
            level: monster.level,
            exp: monster.exp,
            hp: monster.hp,
            attack: monster.attack,
            defense: monster.defense,
            speed: monster.speed,
            dna: monster.dna as unknown as Prisma.InputJsonValue,
            generation: monster.generation,
            battleCount: monster.battleCount,
            wins: monster.wins,
            ownerId: trainerId,
            skills: { create: links },
          },
        });
        return "captured" as const;
      });
    } catch (error) {
      if (error instanceof CaptureRaceLost) return "encounter-invalid";
      throw error;
    }
  },

  async saveTeam(trainerId, monsterIds) {
    await prisma.$transaction(async (tx) => {
      await tx.teamSlot.deleteMany({ where: { trainerId } });
      await tx.teamSlot.createMany({
        data: monsterIds.map((monsterId, index) => ({
          trainerId,
          monsterId,
          slot: index + 1,
        })),
      });
    });
  },

  async getTeam(trainerId) {
    const rows = await prisma.teamSlot.findMany({
      where: { trainerId },
      orderBy: { slot: "asc" },
      include: { monster: { include: monsterInclude } },
    });
    if (rows.length !== 3) return null;
    return rows.map((row) => toMonster(row.monster));
  },

  async createBattle(state, playerMonsterIds) {
    await prisma.$transaction(async (tx) => {
      await tx.battle.create({
        data: {
          id: state.id,
          trainerId: state.trainerId,
          opponentName: "AI Trainer",
          status: state.status,
          turn: state.turn,
          winner: state.winner ?? null,
          state: state as unknown as Prisma.InputJsonValue,
          logs: [],
        },
      });
      await tx.battleMonster.createMany({
        data: playerMonsterIds.map((monsterId, index) => ({
          battleId: state.id,
          monsterId,
          slot: index + 1,
        })),
      });
    });
  },

  async getBattleById(id): Promise<BattleRecord | null> {
    const row = await prisma.battle.findUnique({ where: { id } });
    if (!row) return null;
    return {
      state: row.state as unknown as BattleState,
      logs: (row.logs ?? []) as unknown as BattleLogEntry[],
      rewards: (row.rewards ?? null) as BattleRewardSettlement | null,
    };
  },

  async getTrainerBattles(trainerId, limit = 10): Promise<BattleSummary[]> {
    const rows = await prisma.battle.findMany({
      where: { trainerId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      status: row.status as BattleStatus,
      winner: (row.winner as BattleWinner) ?? undefined,
      turn: row.turn,
      createdAt: row.createdAt,
    }));
  },

  async submitRound(input: SubmitRoundInput): Promise<SubmitRoundResult> {
    return prisma.$transaction(async (tx) => {
      const battle = await tx.battle.findUnique({
        where: { id: input.battleId },
      });
      if (!battle) return { status: "not-found" } as const;
      if (battle.status !== "active") return { status: "not-active" } as const;
      if (battle.turn !== input.expectedTurn) {
        return { status: "invalid-turn" } as const;
      }

      const current = battle.state as unknown as BattleState;
      const result = input.resolver(current);
      const completedTransition =
        current.status === "active" && result.state.status === "completed";

      let rewards: BattleRewardSettlement | null = null;
      if (completedTransition) {
        await tx.trainer.update({
          where: { id: battle.trainerId },
          data: {
            battleCount: { increment: 1 },
            wins: { increment: result.state.winner === "player" ? 1 : 0 },
          },
        });
        const entries = await tx.battleMonster.findMany({
          where: { battleId: input.battleId },
        });
        for (const entry of entries) {
          await tx.monster.update({
            where: { id: entry.monsterId },
            data: {
              battleCount: { increment: 1 },
              wins: { increment: result.state.winner === "player" ? 1 : 0 },
            },
          });
        }

        if (input.applyRewards) {
          rewards = await input.applyRewards(
            prismaRewardCtx(tx, battle.trainerId),
            result,
          );
        }
      }

      await tx.battle.update({
        where: { id: input.battleId },
        data: {
          state: result.state as unknown as Prisma.InputJsonValue,
          logs: result.logs as unknown as Prisma.InputJsonValue,
          turn: result.state.turn,
          status: result.state.status,
          winner: result.state.winner ?? null,
          rewards: rewards
            ? (rewards as unknown as Prisma.InputJsonValue)
            : undefined,
        },
      });

      return {
        status: "ok",
        state: result.state,
        logs: result.logs,
        rewards,
      } as const;
    });
  },

  async commitEvolution(
    params: CommitEvolutionParams,
  ): Promise<CommitEvolutionResult> {
    return prisma.$transaction(async (tx) => {
      const monster = await tx.monster.findUnique({
        where: { id: params.monsterId },
      });
      if (
        !monster ||
        monster.ownerId !== params.trainerId ||
        monster.speciesId !== params.fromSpeciesId
      ) {
        return { status: "invalid" } as const;
      }

      if (params.consumedItemSlug) {
        const item = await tx.item.findUnique({
          where: { slug: params.consumedItemSlug },
        });
        if (!item) return { status: "no-item" } as const;
        const consumed = await tx.inventory.updateMany({
          where: {
            trainerId: params.trainerId,
            itemId: item.id,
            quantity: { gt: 0 },
          },
          data: { quantity: { decrement: 1 } },
        });
        if (consumed.count === 0) return { status: "no-item" } as const;
      }

      // Replace the monster's skills with the evolved moveset.
      const links = await skillLinksFor(tx, params.monster);
      await tx.monsterSkill.deleteMany({
        where: { monsterId: params.monsterId },
      });
      await tx.monsterSkill.createMany({
        data: links.map((link) => ({
          monsterId: params.monsterId,
          skillId: link.skillId,
          slot: link.slot,
        })),
      });
      await tx.monster.update({
        where: { id: params.monsterId },
        data: {
          speciesId: params.monster.speciesId,
          name: params.monster.name,
          level: params.monster.level,
          exp: params.monster.exp,
          hp: params.monster.hp,
          attack: params.monster.attack,
          defense: params.monster.defense,
          speed: params.monster.speed,
          generation: params.monster.generation,
          battleCount: params.monster.battleCount,
          wins: params.monster.wins,
        },
      });

      const historyRow = await tx.monsterEvolution.create({
        data: {
          monsterId: params.monsterId,
          fromSpeciesId: params.fromSpeciesId,
          toSpeciesId: params.toSpeciesId,
          level: params.level,
        },
      });

      return {
        status: "ok",
        history: {
          id: historyRow.id,
          monsterId: historyRow.monsterId,
          fromSpeciesId: historyRow.fromSpeciesId,
          toSpeciesId: historyRow.toSpeciesId,
          level: historyRow.level,
          createdAt: historyRow.createdAt,
        },
      } as const;
    });
  },

  async getEvolutionHistory(monsterId): Promise<EvolutionHistoryRecord[]> {
    const rows = await prisma.monsterEvolution.findMany({
      where: { monsterId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      monsterId: row.monsterId,
      fromSpeciesId: row.fromSpeciesId,
      toSpeciesId: row.toSpeciesId,
      level: row.level,
      createdAt: row.createdAt,
    }));
  },

  // ---------------- Wallet (Phase 7) ----------------

  async getVerifiedWallet(trainerId): Promise<string | null> {
    const user = await getUserForTrainer(trainerId);
    return user?.walletAddress ?? null;
  },

  // ---------------- NFT mint state machine (Phase 7) ----------------

  async getMonsterByTokenId(tokenId) {
    const row = await prisma.monster.findUnique({
      where: { tokenId },
      include: monsterInclude,
    });
    return row ? toMonster(row) : null;
  },

  async tryAcquireMintLock(monsterId): Promise<MintLockResult> {
    // Compare-and-set: only OFFCHAIN / MINT_FAILED may enter MINT_PENDING.
    const result = await prisma.monster.updateMany({
      where: {
        id: monsterId,
        OR: [{ mintStatus: "OFFCHAIN" }, { mintStatus: "MINT_FAILED" }],
      },
      data: { mintStatus: "MINT_PENDING", mintUpdatedAt: new Date() },
    });
    if (result.count > 0) return "acquired";
    const monster = await prisma.monster.findUnique({ where: { id: monsterId } });
    if (monster?.mintStatus === "MINT_CONFIRMED") return "confirmed";
    return "in-progress";
  },

  async setMintSubmitted(monsterId, submission: MintSubmission) {
    await prisma.monster.update({
      where: { id: monsterId },
      data: {
        mintStatus: "MINT_SUBMITTED",
        mintTxHash: submission.txHash,
        mintChainId: submission.chainId,
        mintContractAddress: submission.contractAddress,
        mintRecipient: submission.recipient,
        mintSubmittedAt: new Date(),
        mintUpdatedAt: new Date(),
      },
    });
  },

  async setMintConfirmed(monsterId, tokenId, owner) {
    await prisma.monster.update({
      where: { id: monsterId },
      data: {
        mintStatus: "MINT_CONFIRMED",
        tokenId,
        mintRecipient: owner,
        mintError: null,
        mintConfirmedAt: new Date(),
        mintUpdatedAt: new Date(),
      },
    });
  },

  async setMintFailed(monsterId, error) {
    await prisma.monster.update({
      where: { id: monsterId },
      data: {
        mintStatus: "MINT_FAILED",
        mintError: error,
        mintUpdatedAt: new Date(),
      },
    });
  },

  async releaseMintLock(monsterId) {
    await prisma.monster.updateMany({
      where: { id: monsterId, mintStatus: "MINT_PENDING" },
      data: {
        mintStatus: "MINT_FAILED",
        mintError: "Mint attempt was interrupted; please retry.",
        mintUpdatedAt: new Date(),
      },
    });
  },

  async setOwnershipMismatch(monsterId, mismatch) {
    await prisma.monster.update({
      where: { id: monsterId },
      data: { ownershipMismatch: mismatch },
    });
  },

  // ---------------- On-chain evolution jobs (Phase 7) ----------------

  async createOnchainEvolution(
    monsterId,
    input: CreateEvolutionJobInput,
  ): Promise<CreateEvolutionJobResult> {
    const inProgress = await prisma.onchainEvolution.findFirst({
      where: {
        monsterId,
        status: {
          in: ["EVOLUTION_PENDING", "EVOLUTION_SUBMITTED", "CHAIN_CONFIRMED"],
        },
      },
    });
    if (inProgress) {
      return { status: "in-progress", job: toEvolutionJob(inProgress) };
    }
    const job = await prisma.onchainEvolution.create({
      data: {
        monsterId,
        fromSpeciesId: input.fromSpeciesId,
        toSpeciesId: input.toSpeciesId,
        fromStage: input.fromStage,
        toStage: input.toStage,
        status: "EVOLUTION_PENDING",
      },
    });
    return { status: "created", job: toEvolutionJob(job) };
  },

  async getOnchainEvolutionByMonster(monsterId): Promise<OnchainEvolutionJob[]> {
    const rows = await prisma.onchainEvolution.findMany({
      where: { monsterId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toEvolutionJob);
  },

  async setOnchainEvolutionStatus(jobId, status, patch = {}) {
    await prisma.onchainEvolution.update({
      where: { id: jobId },
      data: {
        status,
        txHash: patch.txHash,
        chainId: patch.chainId,
        contractAddress: patch.contractAddress,
        error: patch.error,
        confirmedAt: patch.confirmedAt,
        syncedAt: patch.syncedAt,
      },
    });
  },

  // ---------------- Ownership sync (Phase 8) ----------------

  async getMonstersByOnchainOwner(walletAddress) {
    const rows = await prisma.monster.findMany({
      where: { onchainOwnerAddress: walletAddress, mintStatus: "MINT_CONFIRMED" },
      include: monsterInclude,
    });
    return rows.map(toMonster);
  },

  async setMonsterOwner(monsterId, ownerId, onchainOwnerAddress = null) {
    await prisma.$transaction(async (tx) => {
      await tx.monster.update({
        where: { id: monsterId },
        data: {
          ownerId,
          onchainOwnerAddress: onchainOwnerAddress ?? null,
          ownershipMismatch: false,
        },
      });
      // Remove stale team slots (sold / transferred monsters leave teams).
      await tx.teamSlot.deleteMany({ where: { monsterId } });
    });
  },

  async removeTeamSlotByMonster(monsterId) {
    await prisma.teamSlot.deleteMany({ where: { monsterId } });
  },

  // ---------------- Marketplace listings (Phase 8) ----------------

  async getListingByMonster(monsterId): Promise<MarketplaceListingRecord | null> {
    const row = await prisma.marketplaceListing.findUnique({
      where: { monsterId },
    });
    return row ? toListing(row) : null;
  },

  async getActiveListingByMonster(monsterId): Promise<MarketplaceListingRecord | null> {
    const row = await prisma.marketplaceListing.findFirst({
      where: { monsterId, status: "ACTIVE" },
    });
    return row ? toListing(row) : null;
  },

  async createListing(monsterId, sellerId, input: CreateListingInput) {
    const row = await prisma.marketplaceListing.create({
      data: {
        sellerId,
        monsterId,
        tokenId: input.tokenId,
        priceWei: BigInt(input.priceWei),
        currency: "ETH",
        status: "PENDING",
        chainId: input.chainId,
        nftContractAddress: input.nftContractAddress,
        marketplaceAddress: input.marketplaceAddress,
      },
    });
    return toListing(row);
  },

  async updateListingStatus(id, patch: ListingStatusPatch) {
    await prisma.marketplaceListing.update({
      where: { id },
      data: {
        status: patch.status,
        listingTxHash:
          patch.status === "PENDING" || patch.status === "ACTIVE"
            ? patch.txHash
            : undefined,
        cancelTxHash:
          patch.status === "CANCEL_PENDING" || patch.status === "CANCELLED"
            ? patch.txHash
            : undefined,
        saleTxHash:
          patch.status === "SALE_PENDING" || patch.status === "SOLD"
            ? patch.txHash
            : undefined,
        buyerWallet: patch.buyerWallet,
        soldAt: patch.soldAt,
        cancelAt: patch.cancelAt,
      },
    });
  },

  async listActiveListings(): Promise<MarketplaceListingWithMonster[]> {
    const rows = await prisma.marketplaceListing.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      include: { monster: { include: monsterInclude } },
    });
    return rows.map((row) => ({ ...toListing(row), monster: toMonster(row.monster) }));
  },

  async listTrainerListings(trainerId): Promise<MarketplaceListingWithMonster[]> {
    const rows = await prisma.marketplaceListing.findMany({
      where: { sellerId: trainerId },
      orderBy: { createdAt: "desc" },
      include: { monster: { include: monsterInclude } },
    });
    return rows.map((row) => ({ ...toListing(row), monster: toMonster(row.monster) }));
  },

  // ---------------- Pixel World ----------------

  async getWorldSpawns(worldMap?: string): Promise<WorldSpawnRecord[]> {
    const rows = await prisma.worldSpawn.findMany({
      where: worldMap ? { worldMap } : undefined,
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      worldMap: row.worldMap,
      speciesId: row.speciesId,
      zoneId: row.zoneId,
      x: row.x,
      y: row.y,
      level: row.level,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    }));
  },

  async saveWorldSpawns(spawns: WorldSpawnRecord[], capacity = Number.MAX_SAFE_INTEGER): Promise<void> {
    if (spawns.length === 0) return;
    await prisma.$transaction(async (tx) => {
      // A transaction-scoped advisory lock serializes lazy reconciliation
      // across Node processes without adding a background worker or schema.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(81720341)`;
      const worldMap = spawns[0]?.worldMap;
      const current = await tx.worldSpawn.count({
        where: { expiresAt: { gt: new Date() }, ...(worldMap ? { worldMap } : {}) },
      });
      const allowed = Math.max(0, capacity - current);
      if (allowed === 0) return;
      await tx.worldSpawn.createMany({
        data: spawns.slice(0, allowed).map((s) => ({
          id: s.id,
          worldMap: s.worldMap,
          speciesId: s.speciesId,
          zoneId: s.zoneId,
          x: s.x,
          y: s.y,
          level: s.level,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
        })),
        skipDuplicates: true,
      });
    });
  },

  async deleteExpiredWorldSpawns(now: Date): Promise<number> {
    const result = await prisma.worldSpawn.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    return result.count;
  },

  async deleteWorldSpawn(id: string): Promise<void> {
    await prisma.worldSpawn.deleteMany({ where: { id } });
  },

  async getTrainerWorldPosition(trainerId) {
    const trainer = await prisma.trainer.findUnique({ where: { id: trainerId } });
    if (!trainer) return null;
    return {
      worldMap: trainer.worldMap,
      worldX: trainer.worldX,
      worldY: trainer.worldY,
    };
  },

  async saveTrainerWorldPosition(trainerId, position): Promise<void> {
    await prisma.trainer.update({
      where: { id: trainerId },
      data: {
        worldMap: position.worldMap,
        worldX: position.worldX,
        worldY: position.worldY,
      },
    });
  },

  async getPickupClaims(trainerId): Promise<WorldPickupClaimRecord[]> {
    const rows = await prisma.worldPickupClaim.findMany({ where: { trainerId } });
    return rows.map((row) => ({
      id: row.id,
      trainerId: row.trainerId,
      pickupKey: row.pickupKey,
      claimedAt: row.claimedAt,
    }));
  },

  async claimPickup(trainerId, pickupKey, now): Promise<"claimed" | "cooldown"> {
    try {
      await prisma.worldPickupClaim.create({
        data: { trainerId, pickupKey, claimedAt: now },
      });
      return "claimed";
    } catch {
      return "cooldown"; // unique(trainerId, pickupKey) violated → already claimed
    }
  },

  async claimPickupReward(trainerId, pickupKey, now, cooldownMs, reward) {
    try {
      return await prisma.$transaction(async (tx) => {
        let item: { id: number } | null = null;
        if (reward.itemSlug) {
          item = await tx.item.findUnique({
            where: { slug: reward.itemSlug },
            select: { id: true },
          });
          if (!item) return { ok: false as const, error: "unknown-item" as const };
        }

        const cutoff = new Date(now.getTime() - cooldownMs);
        const refreshed = await tx.worldPickupClaim.updateMany({
          where: { trainerId, pickupKey, claimedAt: { lte: cutoff } },
          data: { claimedAt: now },
        });
        if (refreshed.count === 0) {
          const existing = await tx.worldPickupClaim.findUnique({
            where: { trainerId_pickupKey: { trainerId, pickupKey } },
          });
          if (existing) return { ok: false as const, error: "cooldown" as const };
          await tx.worldPickupClaim.create({ data: { trainerId, pickupKey, claimedAt: now } });
        }

        if (item && reward.itemSlug) {
          await tx.inventory.upsert({
            where: { trainerId_itemId: { trainerId, itemId: item.id } },
            update: { quantity: { increment: reward.quantity } },
            create: { trainerId, itemId: item.id, quantity: reward.quantity },
          });
        }
        const trainer = reward.gold
          ? await tx.trainer.update({
              where: { id: trainerId },
              data: { gold: { increment: reward.gold } },
              select: { gold: true },
            })
          : await tx.trainer.findUnique({ where: { id: trainerId }, select: { gold: true } });
        if (!trainer) throw new Error("Trainer not found.");
        return { ok: true as const, goldAfter: trainer.gold };
      });
    } catch (error) {
      // A first-claim race resolves through the database uniqueness rule; the
      // losing transaction has rolled back before this cooldown response.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { ok: false as const, error: "cooldown" as const };
      }
      throw error;
    }
  },

  async purchaseShopItem(trainerId, itemSlug, quantity, unitPrice) {
    const cost = unitPrice * quantity;
    return prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({ where: { slug: itemSlug } });
      if (!item) return { ok: false as const, error: "Unknown item." };
      // Conditional decrement closes concurrent overspend: at most one
      // transaction can spend the last available gold.
      const debit = await tx.trainer.updateMany({
        where: { id: trainerId, gold: { gte: cost } },
        data: { gold: { decrement: cost } },
      });
      if (debit.count === 0) return { ok: false as const, error: "Not enough gold." };
      await tx.inventory.upsert({
        where: { trainerId_itemId: { trainerId, itemId: item.id } },
        update: { quantity: { increment: quantity } },
        create: { trainerId, itemId: item.id, quantity },
      });

      const after = await tx.trainer.findUnique({ where: { id: trainerId } });
      return { ok: true as const, goldAfter: after?.gold ?? 0 };
    });
  },

  async grantStarterSupply(trainerId): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const trainer = await tx.trainer.findUnique({ where: { id: trainerId } });
      if (!trainer || trainer.starterSupplyClaimed) return false;

      const items = await tx.item.findMany({
        where: { slug: { in: Object.keys(STARTER_INVENTORY) } },
      });
      if (items.length !== Object.keys(STARTER_INVENTORY).length) {
        throw new Error("Canonical starter items must be seeded before creating a player.");
      }
      for (const item of items) {
        const qty = STARTER_INVENTORY[item.slug] ?? 0;
        await tx.inventory.upsert({
          where: { trainerId_itemId: { trainerId, itemId: item.id } },
          update: { quantity: { increment: qty } },
          create: { trainerId, itemId: item.id, quantity: qty },
        });
      }
      await tx.trainer.update({
        where: { id: trainerId },
        data: { starterSupplyClaimed: true },
      });
      return true;
    });
  },

  async addGold(trainerId, amount): Promise<number> {
    const trainer = await prisma.trainer.update({
      where: { id: trainerId },
      data: { gold: { increment: amount } },
    });
    return trainer.gold;
  },

  async getDailySupplyState(trainerId) {
    const trainer = await prisma.trainer.findUnique({ where: { id: trainerId } });
    return { lastClaimedAt: trainer?.lastDailySupplyAt ?? null };
  },

  async claimDailySupply(trainerId, now) {
    const result = await prisma.trainer.updateMany({
      where: {
        id: trainerId,
        OR: [
          { lastDailySupplyAt: null },
          { lastDailySupplyAt: { lte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
        ],
      },
      data: { lastDailySupplyAt: now },
    });
    if (result.count === 0) return { ok: false as const, error: "Daily supply already claimed." };
    return { ok: true as const };
  },

  async claimDailySupplyBundle(trainerId, now, items) {
    return prisma.$transaction(async (tx) => {
      const dbItems = await tx.item.findMany({
        where: { slug: { in: items.map((item) => item.itemSlug) } },
        select: { id: true, slug: true },
      });
      if (dbItems.length !== items.length) {
        return { ok: false as const, error: "Daily supply item is unavailable." };
      }
      const claimed = await tx.trainer.updateMany({
        where: {
          id: trainerId,
          OR: [
            { lastDailySupplyAt: null },
            { lastDailySupplyAt: { lte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
          ],
        },
        data: { lastDailySupplyAt: now },
      });
      if (claimed.count === 0) {
        return { ok: false as const, error: "Daily supply already claimed." };
      }
      for (const grant of items) {
        const item = dbItems.find((candidate) => candidate.slug === grant.itemSlug)!;
        await tx.inventory.upsert({
          where: { trainerId_itemId: { trainerId, itemId: item.id } },
          update: { quantity: { increment: grant.quantity } },
          create: { trainerId, itemId: item.id, quantity: grant.quantity },
        });
      }
      return { ok: true as const };
    });
  },
};
