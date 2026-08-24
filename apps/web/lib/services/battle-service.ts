import {
  averageTeamPower,
  chooseAiAction,
  generateMonster,
  randomId,
  resolveRound,
  selectAiSpecies,
  type BattleAction,
  type BattleCreatureState,
  type BattleLogEntry,
  type BattleState,
} from "@chainmon/game-engine";
import { MONSTER_SPECIES } from "@chainmon/monster-data";
import type { Monster } from "@chainmon/shared";
import type {
  BattleRecord,
  BattleRewardSettlement,
  BattleSummary,
  GameRepository,
} from "@/lib/data";
import { computeBattleRewards } from "./progression-service";
import { assertNotListed } from "./marketplace-service";

export class BattleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BattleError";
  }
}

export const BATTLE_TEAM_SIZE = 3;

// ---------------------------------------------------------------------------
// Snapshot mapping (Phase 4: collection HP is the max/battle HP; battle keeps
// its own currentHp — collection monsters are never modified by battles)
// ---------------------------------------------------------------------------

function toPlayerCreature(monster: Monster): BattleCreatureState {
  return {
    battleMonsterId: randomId(),
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

function toAiCreature(monster: Monster): BattleCreatureState {
  return {
    battleMonsterId: randomId(),
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

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

export async function saveBattleTeam(
  repository: GameRepository,
  trainerId: string,
  monsterIds: readonly string[],
): Promise<void> {
  if (monsterIds.length !== BATTLE_TEAM_SIZE) {
    throw new BattleError("A battle team needs exactly 3 monsters.");
  }
  if (new Set(monsterIds).size !== BATTLE_TEAM_SIZE) {
    throw new BattleError("Team monsters must be different.");
  }

  const owned = await repository.listMonsters();
  const ownedIds = new Set(owned.map((m) => m.id));
  for (const id of monsterIds) {
    if (!ownedIds.has(id)) {
      throw new BattleError("You can only use monsters you own.");
    }
    // Marketplace gameplay lock: listed monsters cannot join teams.
    await assertNotListed(repository, id);
  }

  await repository.saveTeam(trainerId, monsterIds);
}

// ---------------------------------------------------------------------------
// Battle lifecycle
// ---------------------------------------------------------------------------

export async function createBattle(
  repository: GameRepository,
  trainerId: string,
): Promise<BattleState> {
  const team = await repository.getTeam(trainerId);
  if (!team || team.length !== BATTLE_TEAM_SIZE) {
    throw new BattleError("Complete your 3-monster team first.");
  }

  const playerTeam = team.map(toPlayerCreature);
  const playerPower = averageTeamPower(playerTeam);

  // AI team scaled to the player's power (level 1 monsters, Phase 4).
  const { species } = selectAiSpecies(playerPower, MONSTER_SPECIES);
  const opponentTeam = species.map((entry) =>
    toAiCreature(generateMonster(entry)),
  );

  const now = new Date();
  const state: BattleState = {
    id: randomId(),
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

  await repository.createBattle(state, team.map((m) => m.id));
  return state;
}

export interface SubmitBattleActionResult {
  state: BattleState;
  logs: BattleLogEntry[];
  /** reward snapshot (null while the battle is still active) */
  rewards: BattleRewardSettlement | null;
}

export async function submitBattleAction(
  repository: GameRepository,
  params: {
    trainerId: string;
    battleId: string;
    expectedTurn: number;
    action: BattleAction;
  },
): Promise<SubmitBattleActionResult> {
  const { trainerId, battleId, expectedTurn, action } = params;

  const result = await repository.submitRound({
    battleId,
    expectedTurn,
    resolver: (current) => {
      if (current.trainerId !== trainerId) {
        throw new BattleError("This battle does not belong to you.");
      }
      const aiAction = chooseAiAction(current);
      return resolveRound(current, action, aiAction);
    },
    // Rewards settle exactly once, atomically with ACTIVE→COMPLETED.
    applyRewards: computeBattleRewards,
  });

  if (result.status === "not-found") {
    throw new BattleError("Battle not found.");
  }
  if (result.status === "not-active") {
    throw new BattleError("This battle is already over.");
  }
  if (result.status === "invalid-turn") {
    throw new BattleError("Stale turn — please refresh the page.");
  }

  return { state: result.state, logs: result.logs, rewards: result.rewards };
}

export async function getBattle(
  repository: GameRepository,
  trainerId: string,
  battleId: string,
): Promise<BattleRecord> {
  const record = await repository.getBattleById(battleId);
  if (!record) {
    throw new BattleError("Battle not found.");
  }
  if (record.state.trainerId !== trainerId) {
    throw new BattleError("This battle does not belong to you.");
  }
  return record;
}

export async function listBattleHistory(
  repository: GameRepository,
  trainerId: string,
  limit = 8,
): Promise<BattleSummary[]> {
  return repository.getTrainerBattles(trainerId, limit);
}
