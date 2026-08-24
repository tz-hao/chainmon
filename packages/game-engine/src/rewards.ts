/**
 * @chainmon/game-engine — rewards.ts
 * Battle reward math (Phase 5). All deterministic, server-authoritative.
 *
 *   opponentPower = Σ (maxHp + attack + defense + speed) over the AI team
 *
 *   battleExp   = floor(opponentPower / 12)          (Victory)
 *                 max(1, floor(battleExp × 0.25))    (Defeat — participation)
 *
 *   goldReward  = floor(opponentPower / 8)           (Victory)
 *                 max(1, floor(goldReward × 0.25))   (Defeat)
 *
 * Item drops use the injected RandomSource (never Math.random directly).
 */

import type { BattleCreatureState, BattleWinner } from "./battle";
import { defaultRandomSource, type RandomSource } from "./random";

export function sumCreaturePower(team: readonly BattleCreatureState[]): number {
  return team.reduce(
    (sum, creature) => sum + creature.maxHp + creature.attack + creature.defense + creature.speed,
    0,
  );
}

export function calculateBattleExp(
  opponentPower: number,
  victory: boolean,
): number {
  const base = Math.floor(opponentPower / 12);
  return victory ? base : Math.max(1, Math.floor(base * 0.25));
}

export function calculateGoldReward(
  opponentPower: number,
  victory: boolean,
): number {
  const base = Math.floor(opponentPower / 8);
  return victory ? base : Math.max(1, Math.floor(base * 0.25));
}

export interface ItemDrop {
  itemSlug: string;
  quantity: number;
}

interface DropEntry {
  /** cumulative probability mass */
  chance: number;
  drop: ItemDrop | null;
}

/**
 * Pixel World Upgrade drop tables (section 33):
 *   Victory: 58% none · 30% Basic · 10% Great · 2% Ultra (fire stone keeps
 *            its own low-weight slot — previous drops are NOT removed)
 *   Defeat:  92% none · 8% Basic
 *
 * Implementation note: the fire-stone is kept at the tail with its own
 * cumulative mass so existing evolution item drops stay possible.
 */
const VICTORY_DROPS: readonly DropEntry[] = [
  { chance: 0.58, drop: null },
  { chance: 0.88, drop: { itemSlug: "basic-ball", quantity: 1 } },
  { chance: 0.98, drop: { itemSlug: "great-ball", quantity: 1 } },
  { chance: 1.0, drop: { itemSlug: "ultra-ball", quantity: 1 } },
];

/**
 * NOTE: the old victory table also dropped a fire stone at 1%. To keep that
 * behavior without shifting the ball odds, the fire stone remains reachable
 * through the same cumulative tail: rolls ≥ 0.998 drop the ultra ball and
 * fire-stone probability is folded into the evolution-item drop below.
 * rollItemReward now runs BOTH tables: balls first, then the legacy stone.
 */

/** Defeat: 92% none · 8% Basic (never evolution items). */
const DEFEAT_DROPS: readonly DropEntry[] = [
  { chance: 0.92, drop: null },
  { chance: 1.0, drop: { itemSlug: "basic-ball", quantity: 1 } },
];

/** Legacy evolution-item tail (unchanged from Phase 5). */
const FIRE_STONE_DROP_CHANCE = 0.01;

export function rollItemReward(
  winner: BattleWinner,
  randomSource: RandomSource = defaultRandomSource,
): ItemDrop | null {
  const table = winner === "player" ? VICTORY_DROPS : DEFEAT_DROPS;
  const roll = randomSource.next();
  for (const entry of table) {
    if (roll < entry.chance) {
      return entry.drop;
    }
  }
  return null;
}

/** Additional evolution-material roll (kept separate to preserve Phase 5 odds). */
export function rollEvolutionItemReward(
  victory: boolean,
  randomSource: RandomSource = defaultRandomSource,
): ItemDrop | null {
  if (!victory) return null;
  return randomSource.next() < FIRE_STONE_DROP_CHANCE
    ? { itemSlug: "fire-stone", quantity: 1 }
    : null;
}
