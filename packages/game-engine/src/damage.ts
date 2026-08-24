/**
 * @chainmon/game-engine — damage.ts
 * Unified damage calculator (Phase 4).
 *
 *   baseDamage  = (power × attacker.attack / max(defender.defense, 1)) × 0.5
 *   damage      = max(1, floor(baseDamage × elementMultiplier × randomFactor × defendMultiplier))
 *   randomFactor = 0.9 ~ 1.1  (from the injected RandomSource)
 *   defendMultiplier = 0.5 when the defender is defending
 *
 * A miss deals 0 damage — miss is decided by the caller via isHit().
 * No critical hits, no status effects in Phase 4.
 */

import {
  defaultRandomSource,
  randomFloat,
  type RandomSource,
} from "./random";

export const BASIC_ATTACK_POWER = 40;
export const BASIC_ATTACK_ACCURACY = 100;

export const RANDOM_FACTOR_MIN = 0.9;
export const RANDOM_FACTOR_MAX = 1.1;
export const DEFEND_MULTIPLIER = 0.5;
export const MIN_DAMAGE = 1;

export function calculateBaseDamage(
  power: number,
  attack: number,
  defense: number,
): number {
  if (!Number.isFinite(power) || power < 0) {
    throw new Error(`damage: power must be a non-negative number, got ${power}`);
  }
  if (!Number.isFinite(attack) || attack < 0) {
    throw new Error(`damage: attack must be a non-negative number, got ${attack}`);
  }
  if (!Number.isFinite(defense) || defense < 0) {
    throw new Error(
      `damage: defense must be a non-negative number, got ${defense}`,
    );
  }
  return (power * attack * 0.5) / Math.max(defense, 1);
}

export interface DamageInput {
  power: number;
  attackerAttack: number;
  defenderDefense: number;
  elementMultiplier: number;
  randomFactor: number;
  /** 1.0 normally, 0.5 while defending */
  defendMultiplier?: number;
}

export function calculateDamage(input: DamageInput): number {
  const raw =
    calculateBaseDamage(
      input.power,
      input.attackerAttack,
      input.defenderDefense,
    ) *
    input.elementMultiplier *
    input.randomFactor *
    (input.defendMultiplier ?? 1);
  return Math.max(MIN_DAMAGE, Math.floor(raw));
}

/** accuracy is a percentage (0-100); hit when roll < accuracy / 100. */
export function isHit(accuracy: number, roll: number): boolean {
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) {
    throw new Error(`damage: accuracy must be in [0, 100], got ${accuracy}`);
  }
  return roll < accuracy / 100;
}

/** randomFactor in [0.9, 1.1) from the injected source. */
export function randomDamageFactor(
  randomSource: RandomSource = defaultRandomSource,
): number {
  return randomFloat(RANDOM_FACTOR_MIN, RANDOM_FACTOR_MAX, randomSource);
}
