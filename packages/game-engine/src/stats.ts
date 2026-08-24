/**
 * @chainmon/game-engine — stats.ts
 * Canonical stat formulas (Phase 5 — replaces the Phase 2 placeholder curve).
 *
 *   stat = baseStat + floor(gene / 10) + levelGrowth
 *   levelGrowth = floor((level - 1) × growthRate × dnaGrowthModifier)
 *   dnaGrowthModifier = 0.75 + gene / 200
 *
 *   gene:    0 → 0.75x · 50 → 1.0x · 100 → 1.25x growth
 *   growthRate: HP 2.5 · Attack 1.6 · Defense 1.6 · Speed 1.3
 *
 * Same species + same DNA at a higher level → visibly different growth per
 * gene, but bounded. Stats are ALWAYS recomputed from canonical data —
 * never accumulated incrementally (no drift).
 */

import type { MonsterDNA } from "@chainmon/shared";

export const DNA_MIN = 0;
export const DNA_MAX = 100;

export const STAT_GROWTH_RATES = {
  hp: 2.5,
  attack: 1.6,
  defense: 1.6,
  speed: 1.3,
} as const;

/** Clamp a raw gene value into the legal 0-100 integer range. */
export function clampGene(gene: number): number {
  return Math.min(DNA_MAX, Math.max(DNA_MIN, Math.floor(gene)));
}

/** floor(gene / 10) — the flat DNA bonus applied on top of base stats. */
export function dnaBonus(gene: number): number {
  return Math.floor(clampGene(gene) / 10);
}

/** 0.75 + gene / 200 — gene 0 → 0.75x, 50 → 1.0x, 100 → 1.25x. */
export function dnaGrowthModifier(gene: number): number {
  return 0.75 + clampGene(gene) / 200;
}

/** floor((level - 1) × growthRate × dnaGrowthModifier(gene)) */
export function levelGrowth(
  level: number,
  growthRate: number,
  gene: number,
): number {
  if (!Number.isInteger(level) || level < 1) {
    throw new Error(`stats: level must be a positive integer, got ${level}`);
  }
  return Math.floor((level - 1) * growthRate * dnaGrowthModifier(gene));
}

/**
 * Single-stat formula (Phase 5):
 *   base + floor(gene/10) + floor((level-1) × growthRate × (0.75 + gene/200))
 */
export function calculateStat(
  base: number,
  gene: number,
  level = 1,
  growthRate = 2,
): number {
  return base + dnaBonus(gene) + levelGrowth(level, growthRate, gene);
}

export interface BaseStats {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
}

export interface FinalStats extends BaseStats {}

export interface MonsterStatsSource {
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;
}

/**
 * Canonical full-stat computation for a monster instance.
 * Always recompute from (species, dna, level) — never increment.
 */
export function calculateMonsterStats(
  species: MonsterStatsSource,
  dna: MonsterDNA,
  level = 1,
): FinalStats {
  return {
    hp: calculateStat(species.baseHp, dna.hpGene, level, STAT_GROWTH_RATES.hp),
    attack: calculateStat(
      species.baseAttack,
      dna.attackGene,
      level,
      STAT_GROWTH_RATES.attack,
    ),
    defense: calculateStat(
      species.baseDefense,
      dna.defenseGene,
      level,
      STAT_GROWTH_RATES.defense,
    ),
    speed: calculateStat(
      species.baseSpeed,
      dna.speedGene,
      level,
      STAT_GROWTH_RATES.speed,
    ),
  };
}

export function isLegalDNA(dna: MonsterDNA): boolean {
  return (
    Number.isInteger(dna.hpGene) &&
    Number.isInteger(dna.attackGene) &&
    Number.isInteger(dna.defenseGene) &&
    Number.isInteger(dna.speedGene) &&
    Number.isInteger(dna.mutationGene) &&
    dna.hpGene >= DNA_MIN &&
    dna.hpGene <= DNA_MAX &&
    dna.attackGene >= DNA_MIN &&
    dna.attackGene <= DNA_MAX &&
    dna.defenseGene >= DNA_MIN &&
    dna.defenseGene <= DNA_MAX &&
    dna.speedGene >= DNA_MIN &&
    dna.speedGene <= DNA_MAX &&
    dna.mutationGene >= DNA_MIN &&
    dna.mutationGene <= DNA_MAX
  );
}
