import "server-only";

import { createHash } from "node:crypto";
import {
  generateMonster,
  type BattleCreatureState,
  type BattleState,
  type WildEncounter,
} from "@chainmon/game-engine";
import { getSpeciesById } from "@chainmon/monster-data";
import type { Monster, MonsterDNA } from "@chainmon/shared";
import type { BattleRecord, GameRepository } from "@/lib/data";
import { getRiftNode } from "@/lib/rift/generator";
import type { RiftId, RiftNode } from "@/lib/rift/types";
import { assertNotListed } from "./marketplace-service";

export class RiftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RiftError";
  }
}

const FIXED_ENEMY_DNA: MonsterDNA = {
  hpGene: 48,
  attackGene: 48,
  defenseGene: 48,
  speedGene: 48,
  mutationGene: 24,
};

function stableServerId(prefix: string, values: readonly string[]): string {
  const digest = createHash("sha256").update(values.join(":"), "utf8").digest("hex");
  return `${prefix}-${digest.slice(0, 36)}`;
}

function toPlayerCreature(monster: Monster, index: number): BattleCreatureState {
  return {
    battleMonsterId: `rift-player-${index + 1}-${monster.id}`,
    sourceMonsterId: monster.id,
    speciesId: monster.speciesId,
    speciesName: monster.name,
    element: monster.element,
    rarity: monster.rarity,
    level: monster.level,
    maxHp: monster.hp,
    currentHp: monster.hp,
    attack: monster.attack,
    defense: monster.defense,
    speed: monster.speed,
    skills: monster.skills,
    fainted: false,
  };
}

function toEnemyCreature(
  speciesId: number,
  level: number,
  statMultiplier: number,
  index: number,
): BattleCreatureState {
  const species = getSpeciesById(speciesId);
  if (!species) throw new RiftError("Rift enemy species is unavailable.");
  const monster = generateMonster(species, { level, dna: FIXED_ENEMY_DNA });
  const maxHp = Math.max(1, Math.round(monster.hp * statMultiplier));
  return {
    battleMonsterId: `rift-opponent-${index + 1}-${speciesId}`,
    speciesId,
    speciesName: monster.name,
    element: monster.element,
    rarity: monster.rarity,
    level,
    maxHp,
    currentHp: maxHp,
    attack: Math.max(1, Math.round(monster.attack * statMultiplier)),
    defense: Math.max(1, Math.round(monster.defense * statMultiplier)),
    speed: Math.max(1, Math.round(monster.speed * statMultiplier)),
    skills: monster.skills,
    fainted: false,
  };
}

type ConfiguredBattleNode = RiftNode & {
  enemySpeciesIds: number[];
  enemyLevel: number;
  statMultiplier: number;
};

function assertBattleNode(riftId: RiftId, seed: string, nodeId: string): ConfiguredBattleNode {
  const node = getRiftNode(riftId, seed, nodeId);
  if (!node || !["battle", "elite", "boss"].includes(node.type)) {
    throw new RiftError("This Rift node is not a battle.");
  }
  if (!node.enemySpeciesIds?.length || !node.enemyLevel || !node.statMultiplier) {
    throw new RiftError("Rift battle configuration is incomplete.");
  }
  return node as ConfiguredBattleNode;
}

export async function startRiftBattle(
  repository: GameRepository,
  params: {
    trainerId: string;
    riftId: RiftId;
    seed: string;
    nodeId: string;
    monsterIds: readonly string[];
  },
): Promise<BattleRecord> {
  const { trainerId, riftId, seed, nodeId, monsterIds } = params;
  const node = assertBattleNode(riftId, seed, nodeId);

  if (monsterIds.length < 1 || monsterIds.length > 3) {
    throw new RiftError("Select between one and three monsters.");
  }
  if (new Set(monsterIds).size !== monsterIds.length) {
    throw new RiftError("Rift team monsters must be different.");
  }

  const battleId = stableServerId("rift-battle", [trainerId, riftId, seed, nodeId]);
  const existing = await repository.getBattleById(battleId);
  if (existing) {
    if (existing.state.trainerId !== trainerId) {
      throw new RiftError("This Rift battle belongs to another trainer.");
    }
    return existing;
  }

  const owned = await repository.listMonsters(trainerId);
  const ownedById = new Map(owned.map((monster) => [monster.id, monster]));
  const team = monsterIds.map((monsterId) => ownedById.get(monsterId));
  if (team.some((monster) => !monster)) {
    throw new RiftError("You can only deploy monsters you own.");
  }
  for (const monsterId of monsterIds) {
    await assertNotListed(repository, monsterId);
  }

  const playerTeam = (team as Monster[]).map(toPlayerCreature);
  const opponentTeam = node.enemySpeciesIds
    // Rift nodes model a single protocol threat. Extra player team members are
    // tactical reserves, not a request to multiply the enemy party.
    .slice(0, 1)
    .map((speciesId, index) =>
      toEnemyCreature(speciesId, node.enemyLevel!, node.statMultiplier!, index),
    );
  const now = new Date();
  const state: BattleState = {
    id: battleId,
    trainerId,
    status: "active",
    turn: 1,
    playerTeam,
    opponentTeam,
    playerActiveIndex: 0,
    opponentActiveIndex: 0,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await repository.createBattle(state, monsterIds);
  } catch (error) {
    const concurrent = await repository.getBattleById(battleId);
    if (concurrent?.state.trainerId === trainerId) return concurrent;
    throw error;
  }
  return { state, logs: [], rewards: null };
}

export async function getRiftBattle(
  repository: GameRepository,
  trainerId: string,
  battleId: string,
): Promise<BattleRecord> {
  const record = await repository.getBattleById(battleId);
  if (!record || record.state.trainerId !== trainerId || !battleId.startsWith("rift-battle-")) {
    throw new RiftError("Rift battle not found.");
  }
  return record;
}

export async function startRiftEncounter(
  repository: GameRepository,
  params: { trainerId: string; riftId: RiftId; seed: string; nodeId: string },
): Promise<WildEncounter> {
  const { trainerId, riftId, seed, nodeId } = params;
  const node = getRiftNode(riftId, seed, nodeId);
  if (!node || node.type !== "capture" || !node.captureSpeciesId) {
    throw new RiftError("This Rift node is not a capture signal.");
  }
  const species = getSpeciesById(node.captureSpeciesId);
  if (!species) throw new RiftError("Rift capture species is unavailable.");

  const encounterId = stableServerId("rift-encounter", [trainerId, riftId, seed, nodeId]);
  const existing = await repository.getEncounterById(encounterId);
  if (existing) {
    if (existing.trainerId !== trainerId) {
      throw new RiftError("This Rift encounter belongs to another trainer.");
    }
    return existing;
  }

  const now = new Date();
  const maxHp = species.baseHp;
  const encounter: WildEncounter = {
    id: encounterId,
    trainerId,
    regionId: `rift-${riftId}`,
    speciesId: species.id,
    speciesName: species.name,
    element: species.element,
    rarity: species.rarity,
    level: 1,
    currentHp: Math.max(1, Math.floor(maxHp * 0.14)),
    maxHp,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  try {
    await repository.createEncounter(encounter);
  } catch (error) {
    const concurrent = await repository.getEncounterById(encounterId);
    if (concurrent?.trainerId === trainerId) return concurrent;
    throw error;
  }
  return encounter;
}
