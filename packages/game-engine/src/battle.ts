/**
 * @chainmon/game-engine — battle.ts
 * 3v3 turn-based battle state machine (Phase 4, PvE only).
 *
 * Rules:
 *  - Action priority: Switch(2) > Defend(1) > Attack/Skill(0)
 *  - Same priority attacks: higher Speed acts first; Speed tie → RandomSource
 *  - A monster KO'd by the first actor does NOT act this round
 *  - currentHp is clamped at 0 (never negative); fainted = currentHp === 0
 *  - Auto-switch: after a faint, the first healthy monster of that team
 *    enters automatically (no replacement UI in Phase 4)
 *  - Defend halves incoming damage for the current round only
 *  - Battle ends when all 3 monsters of a side are fainted
 *
 * resolveRound() is a pure function — battle logic never lives in
 * React components, server actions or repositories.
 */

import type { Element, Rarity, Skill } from "@chainmon/shared";
import {
  BASIC_ATTACK_ACCURACY,
  BASIC_ATTACK_POWER,
  calculateDamage,
  DEFEND_MULTIPLIER,
  isHit,
  randomDamageFactor,
} from "./damage";
import { getElementMultiplier } from "./elements";
import {
  defaultRandomSource,
  randomFloat,
  type RandomSource,
} from "./random";

export type BattleStatus = "active" | "completed";
export type BattleWinner = "player" | "opponent";
export type BattleSide = "player" | "opponent";

export interface BattleCreatureState {
  battleMonsterId: string;
  /** Collection monster id (player team only; AI creatures have none). */
  sourceMonsterId?: string;
  speciesId: number;
  speciesName: string;
  element: Element;
  rarity: Rarity;
  level: number;
  maxHp: number;
  currentHp: number;
  attack: number;
  defense: number;
  speed: number;
  skills: Skill[];
  fainted: boolean;
  /** True only during the round the monster chose Defend. */
  defending?: boolean;
}

export interface BattleState {
  id: string;
  trainerId: string;
  status: BattleStatus;
  turn: number;
  playerTeam: BattleCreatureState[];
  opponentTeam: BattleCreatureState[];
  playerActiveIndex: number;
  opponentActiveIndex: number;
  winner?: BattleWinner;
  createdAt: Date;
  updatedAt: Date;
}

export type BattleAction =
  | { type: "basic_attack" }
  | { type: "skill"; skillId: string }
  | { type: "defend" }
  | { type: "switch"; targetBattleMonsterId: string };

export interface BattleLogEntry {
  turn: number;
  type:
    | "attack"
    | "skill"
    | "defend"
    | "switch"
    | "miss"
    | "damage"
    | "faint"
    | "battle_end";
  actor: string;
  target?: string;
  message: string;
  damage?: number;
  elementMultiplier?: number;
}

export interface RoundResult {
  state: BattleState;
  logs: BattleLogEntry[];
}

const ACTION_PRIORITY: Record<BattleAction["type"], number> = {
  switch: 2,
  defend: 1,
  basic_attack: 0,
  skill: 0,
};

export function actionPriority(action: BattleAction): number {
  return ACTION_PRIORITY[action.type];
}

function teamOf(state: BattleState, side: BattleSide): BattleCreatureState[] {
  return side === "player" ? state.playerTeam : state.opponentTeam;
}

function activeIndex(state: BattleState, side: BattleSide): number {
  return side === "player" ? state.playerActiveIndex : state.opponentActiveIndex;
}

function setActiveIndex(state: BattleState, side: BattleSide, index: number): void {
  if (side === "player") {
    state.playerActiveIndex = index;
  } else {
    state.opponentActiveIndex = index;
  }
}

function activeCreature(state: BattleState, side: BattleSide): BattleCreatureState {
  const creature = teamOf(state, side)[activeIndex(state, side)];
  if (!creature) {
    throw new Error(`battle: ${side} has no active monster`);
  }
  return creature;
}

export function validateAction(
  state: BattleState,
  side: BattleSide,
  action: BattleAction,
): void {
  if (state.status !== "active") {
    throw new Error("battle: this battle is already over");
  }
  const creature = activeCreature(state, side);
  if (creature.fainted) {
    throw new Error("battle: the active monster is fainted");
  }

  if (action.type === "skill") {
    if (!creature.skills.some((s) => s.id === action.skillId)) {
      throw new Error(`battle: ${creature.speciesName} does not know skill ${action.skillId}`);
    }
  }

  if (action.type === "switch") {
    const team = teamOf(state, side);
    const target = team.find((c) => c.battleMonsterId === action.targetBattleMonsterId);
    if (!target) {
      throw new Error("battle: switch target is not in this team");
    }
    if (target.battleMonsterId === creature.battleMonsterId) {
      throw new Error("battle: cannot switch to the active monster");
    }
    if (target.fainted || target.currentHp <= 0) {
      throw new Error("battle: cannot switch to a fainted monster");
    }
  }
}

export function cloneBattleState(state: BattleState): BattleState {
  return structuredClone(state);
}

function autoSwitchIfFainted(
  state: BattleState,
  side: BattleSide,
  logs: BattleLogEntry[],
): void {
  const team = teamOf(state, side);
  const index = activeIndex(state, side);
  if (!team[index]?.fainted) return;

  const replacement = team.findIndex((c) => !c.fainted && c.currentHp > 0);
  if (replacement >= 0) {
    setActiveIndex(state, side, replacement);
    const creature = team[replacement]!;
    logs.push({
      turn: state.turn,
      type: "switch",
      actor: creature.speciesName,
      message: `${creature.speciesName} entered battle!`,
    });
  }
}

function executeAction(
  state: BattleState,
  side: BattleSide,
  action: BattleAction,
  logs: BattleLogEntry[],
  randomSource: RandomSource,
): void {
  const team = teamOf(state, side);
  const actor = activeCreature(state, side);
  const enemyIndex = activeIndex(
    state,
    side === "player" ? "opponent" : "player",
  );
  const enemyTeam = teamOf(state, side === "player" ? "opponent" : "player");
  const target = enemyTeam[enemyIndex];

  switch (action.type) {
    case "switch": {
      const index = team.findIndex(
        (c) => c.battleMonsterId === action.targetBattleMonsterId,
      );
      if (index < 0) {
        throw new Error("battle: switch target not found");
      }
      setActiveIndex(state, side, index);
      logs.push({
        turn: state.turn,
        type: "switch",
        actor: actor.speciesName,
        target: action.targetBattleMonsterId,
        message: `${actor.speciesName} switched out.`,
      });
      return;
    }

    case "defend": {
      actor.defending = true;
      logs.push({
        turn: state.turn,
        type: "defend",
        actor: actor.speciesName,
        message: `${actor.speciesName} is defending!`,
      });
      return;
    }

    case "basic_attack":
    case "skill": {
      if (!target) {
        throw new Error("battle: no enemy active monster");
      }

      let power = BASIC_ATTACK_POWER;
      let accuracy = BASIC_ATTACK_ACCURACY;
      let elementMultiplier = 1;
      let skillName = "Basic Attack";
      let logType: BattleLogEntry["type"] = "attack";

      if (action.type === "skill") {
        const skill = actor.skills.find((s) => s.id === action.skillId);
        if (!skill) {
          throw new Error(`battle: unknown skill ${action.skillId}`);
        }
        power = skill.power;
        accuracy = skill.accuracy;
        elementMultiplier = getElementMultiplier(skill.element, target.element);
        skillName = skill.name;
        logType = "skill";
      }

      const hit =
        accuracy >= 100 ? true : isHit(accuracy, randomSource.next());
      if (!hit) {
        logs.push({
          turn: state.turn,
          type: "miss",
          actor: actor.speciesName,
          target: target.speciesName,
          message: `${actor.speciesName}'s attack missed!`,
        });
        return;
      }

      logs.push({
        turn: state.turn,
        type: logType,
        actor: actor.speciesName,
        target: target.speciesName,
        message: `${actor.speciesName} used ${skillName}!`,
      });
      if (elementMultiplier > 1) {
        logs.push({
          turn: state.turn,
          type: "damage",
          actor: actor.speciesName,
          target: target.speciesName,
          message: "The attack was highly effective!",
          elementMultiplier,
        });
      } else if (elementMultiplier < 1) {
        logs.push({
          turn: state.turn,
          type: "damage",
          actor: actor.speciesName,
          target: target.speciesName,
          message: "The attack was not very effective.",
          elementMultiplier,
        });
      }

      const damage = calculateDamage({
        power,
        attackerAttack: actor.attack,
        defenderDefense: target.defense,
        elementMultiplier,
        randomFactor: randomDamageFactor(randomSource),
        defendMultiplier: target.defending ? DEFEND_MULTIPLIER : 1,
      });

      target.currentHp = Math.max(0, target.currentHp - damage);
      logs.push({
        turn: state.turn,
        type: "damage",
        actor: actor.speciesName,
        target: target.speciesName,
        message: `${target.speciesName} took ${damage} damage.`,
        damage,
      });

      if (target.currentHp === 0) {
        target.fainted = true;
        logs.push({
          turn: state.turn,
          type: "faint",
          actor: target.speciesName,
          message: `${target.speciesName} fainted!`,
        });
        // Auto-switch is deferred to the end of the round (see resolveRound):
        // a monster KO'd by the first actor must not act this round, and the
        // replacement only enters when the round is over.
      }
      return;
    }
  }
}

/**
 * Resolve one round: player action + AI action → new state + log entries.
 * Throws on invalid actions / non-active battles.
 */
export function resolveRound(
  state: BattleState,
  playerAction: BattleAction,
  aiAction: BattleAction,
  randomSource: RandomSource = defaultRandomSource,
): RoundResult {
  validateAction(state, "player", playerAction);
  validateAction(state, "opponent", aiAction);

  const next = cloneBattleState(state);
  const logs: BattleLogEntry[] = [];

  const playerCreature = () => activeCreature(next, "player");
  const aiCreature = () => activeCreature(next, "opponent");

  // Order by priority, then Speed, then RandomSource tie-break.
  const playerPriority = actionPriority(playerAction);
  const aiPriority = actionPriority(aiAction);
  let order: BattleSide[];

  if (playerPriority !== aiPriority) {
    order =
      playerPriority > aiPriority
        ? ["player", "opponent"]
        : ["opponent", "player"];
  } else if (playerPriority === 0) {
    // Both sides attack: faster monster acts first.
    if (playerCreature().speed !== aiCreature().speed) {
      order =
        playerCreature().speed > aiCreature().speed
          ? ["player", "opponent"]
          : ["opponent", "player"];
    } else {
      order = randomSource.next() < 0.5 ? ["player", "opponent"] : ["opponent", "player"];
    }
  } else {
    // Both switch or both defend — player first, order is irrelevant.
    order = ["player", "opponent"];
  }

  for (const side of order) {
    const action = side === "player" ? playerAction : aiAction;
    const creature = activeCreature(next, side);
    if (creature.fainted) continue; // KO'd by the first actor — no action
    executeAction(next, side, action, logs, randomSource);
  }

  // Defend lasts exactly one round.
  for (const creature of next.playerTeam) {
    creature.defending = false;
  }
  for (const creature of next.opponentTeam) {
    creature.defending = false;
  }

  // End-of-round auto-switch: a fainted active monster is replaced by the
  // first healthy monster of its team.
  autoSwitchIfFainted(next, "player", logs);
  autoSwitchIfFainted(next, "opponent", logs);

  // End-of-round checks.
  const playerAllFainted = next.playerTeam.every((c) => c.fainted);
  const opponentAllFainted = next.opponentTeam.every((c) => c.fainted);

  if (playerAllFainted || opponentAllFainted) {
    next.status = "completed";
    next.winner = playerAllFainted ? "opponent" : "player";
    logs.push({
      turn: next.turn,
      type: "battle_end",
      actor: next.winner,
      message:
        next.winner === "player"
          ? "Victory! The opponent's team is defeated."
          : "Defeat... Your team has no monsters left.",
    });
  }

  next.turn += 1;
  next.updatedAt = new Date();

  return { state: next, logs };
}
