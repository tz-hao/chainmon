/**
 * @chainmon/game-engine — battle-ai.ts
 * Simple deterministic PvE AI (Phase 4). No external APIs, no LLMs.
 *
 * Action selection (all randomness via the injected RandomSource):
 *  1. Element-advantage skill → 70% chance to use the strongest one
 *  2. Low HP (<30%) with a healthy backup → 40% chance to switch
 *  3. Occasional Defend → 15%
 *  4. Otherwise best skill / basic attack
 *
 * AI team generation scales with the player's team power so the fight
 * stays fair (no Common starters vs 3 Legendaries).
 */

import type { MonsterSpeciesData } from "@chainmon/monster-data";
import {
  type BattleAction,
  type BattleCreatureState,
  type BattleState,
} from "./battle";
import { getElementMultiplier } from "./elements";
import { defaultRandomSource, type RandomSource } from "./random";

export function chooseAiAction(
  state: BattleState,
  randomSource: RandomSource = defaultRandomSource,
): BattleAction {
  const ai = state.opponentTeam[state.opponentActiveIndex];
  if (!ai || ai.fainted) {
    throw new Error("ai: no active AI monster");
  }
  const player = state.playerTeam[state.playerActiveIndex];
  if (!player) {
    throw new Error("ai: no active player monster");
  }

  // 1. Element advantage skills are preferred.
  const advantageSkills = ai.skills.filter(
    (skill) => getElementMultiplier(skill.element, player.element) > 1,
  );
  if (advantageSkills.length > 0 && randomSource.next() < 0.7) {
    const best = advantageSkills.reduce((a, b) => (b.power > a.power ? b : a));
    return { type: "skill", skillId: best.id };
  }

  // 2. Low HP + healthy backup → sometimes switch.
  if (ai.currentHp / ai.maxHp < 0.3) {
    const backup = state.opponentTeam.find(
      (c) =>
        c.battleMonsterId !== ai.battleMonsterId && !c.fainted && c.currentHp > 0,
    );
    if (backup && randomSource.next() < 0.4) {
      return { type: "switch", targetBattleMonsterId: backup.battleMonsterId };
    }
  }

  // 3. Occasional Defend.
  if (randomSource.next() < 0.15) {
    return { type: "defend" };
  }

  // 4. Best known skill, else basic attack.
  const bestSkill = ai.skills.reduce((a, b) => (b.power > a.power ? b : a));
  return bestSkill ? { type: "skill", skillId: bestSkill.id } : { type: "basic_attack" };
}

// ---------------------------------------------------------------------------
// AI team generation
// ---------------------------------------------------------------------------

export function averageTeamPower(team: BattleCreatureState[]): number {
  if (team.length === 0) return 0;
  const total = team.reduce(
    (sum, c) => sum + c.maxHp + c.attack + c.defense + c.speed,
    0,
  );
  return Math.round(total / team.length);
}

/** Common + a few Rare species — matches weak/low teams. */
const LOW_TIER_SPECIES = [1, 5, 6, 7, 11, 12, 16, 17, 4, 13, 19];

/** Rare + Epic species — matches mid teams. */
const MID_TIER_SPECIES = [2, 8, 18, 3, 9, 14, 20];

/** Epic + Legendary species — matches strong teams. */
const HIGH_TIER_SPECIES = [3, 9, 14, 20, 10, 15];

export function aiSpeciesPoolFor(playerPower: number): readonly number[] {
  if (playerPower < 225) return LOW_TIER_SPECIES;
  if (playerPower <= 265) return MID_TIER_SPECIES;
  return HIGH_TIER_SPECIES;
}

function pickDistinct(
  pool: readonly number[],
  count: number,
  randomSource: RandomSource,
): number[] {
  const remaining = [...pool];
  const picked: number[] = [];
  while (picked.length < count && remaining.length > 0) {
    const index = Math.floor(randomSource.next() * remaining.length);
    const speciesId = remaining[index];
    if (speciesId !== undefined) {
      remaining.splice(index, 1);
      picked.push(speciesId);
    }
  }
  return picked;
}

/** Pick 3 distinct species scaled to the player's team power. */
export function selectAiSpeciesIds(
  playerPower: number,
  randomSource: RandomSource = defaultRandomSource,
): number[] {
  const pool = aiSpeciesPoolFor(playerPower);
  const picked = pickDistinct(pool, 3, randomSource);
  if (picked.length !== 3) {
    throw new Error("ai: could not assemble a 3-monster AI team");
  }
  return picked;
}

export interface AiTeamSelection {
  species: MonsterSpeciesData[];
}

/** Resolve the 3 AI species from a catalogue. */
export function selectAiSpecies(
  playerPower: number,
  catalogue: readonly MonsterSpeciesData[],
  randomSource: RandomSource = defaultRandomSource,
): AiTeamSelection {
  const ids = selectAiSpeciesIds(playerPower, randomSource);
  const species = ids.map((id) => {
    const entry = catalogue.find((s) => s.id === id);
    if (!entry) {
      throw new Error(`ai: species ${id} missing from catalogue`);
    }
    return entry;
  });
  return { species };
}
