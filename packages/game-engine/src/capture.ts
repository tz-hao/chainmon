/**
 * @chainmon/game-engine — capture.ts
 * All capture math lives here — never in React components, server actions
 * or repositories.
 *
 * Pixel World Upgrade formula (section 22-25):
 *
 *   captureChance = clamp(baseCatchRate × hpModifier × ballModifier, 0.15, 0.95)
 *
 *   HP modifier (section 23):
 *     HP > 70%   → 1.00
 *     HP ≤ 70%   → 1.15
 *     HP ≤ 40%   → 1.40
 *     HP ≤ 15%   → 1.80
 *
 *   Ball modifier (section 24):
 *     Basic 1.0x · Great 1.5x · Ultra 2.0x
 *
 *   Recommended base catch rates (section 25):
 *     Common 0.45–0.60 · Rare 0.28–0.40 · Epic 0.16–0.24 · Legendary 0.08–0.12
 *
 * The minimum clamp is 0.15 (never an impossible catch) and the maximum
 * 0.95 (never guaranteed).
 */

import { randomFloat, type RandomSource } from "./random";

export const MIN_CAPTURE_CHANCE = 0.15;
export const MAX_CAPTURE_CHANCE = 0.95;

export interface CaptureBall {
  slug: string;
  name: string;
  /** capture chance multiplier */
  modifier: number;
}

/** ChainMon Capture Capsules — original designs, not Poké Ball copies. */
export const CAPTURE_BALLS: readonly CaptureBall[] = [
  { slug: "basic-ball", name: "Basic Capsule", modifier: 1.0 },
  { slug: "great-ball", name: "Great Capsule", modifier: 1.5 },
  { slug: "ultra-ball", name: "Ultra Capsule", modifier: 2.0 },
];

export function getCaptureBall(slug: string): CaptureBall | undefined {
  return CAPTURE_BALLS.find((ball) => ball.slug === slug);
}

/**
 * Threshold-based HP modifier (section 23). Full HP is 1.0; the lower the
 * HP ratio the higher the bonus — up to 1.80 at ≤15% HP.
 */
export function hpModifier(currentHp: number, maxHp: number): number {
  validateHp(currentHp, maxHp);
  const hpRatio = currentHp / maxHp;
  if (hpRatio > 0.7) return 1.0;
  if (hpRatio > 0.4) return 1.15;
  if (hpRatio > 0.15) return 1.4;
  return 1.8;
}

export function validateHp(currentHp: number, maxHp: number): void {
  if (!Number.isFinite(currentHp) || !Number.isFinite(maxHp)) {
    throw new Error(`capture: HP must be finite numbers, got ${currentHp}/${maxHp}`);
  }
  if (currentHp < 0) {
    throw new Error(`capture: currentHp must be >= 0, got ${currentHp}`);
  }
  if (maxHp <= 0) {
    throw new Error(`capture: maxHp must be > 0, got ${maxHp}`);
  }
  if (currentHp > maxHp) {
    throw new Error(
      `capture: currentHp (${currentHp}) must not exceed maxHp (${maxHp})`,
    );
  }
}

export interface CaptureChanceParams {
  /** species catch rate — canonical unit 0-1 */
  catchRate: number;
  currentHp: number;
  maxHp: number;
  /** ball capture modifier (Basic 1.0 / Great 1.5 / Ultra 2.0) */
  ballModifier: number;
}

export function calculateCaptureChance(params: CaptureChanceParams): number {
  const { catchRate, currentHp, maxHp, ballModifier } = params;

  if (!Number.isFinite(catchRate) || catchRate < 0 || catchRate > 1) {
    throw new Error(
      `capture: catchRate must be in [0, 1], got ${catchRate}`,
    );
  }
  if (!Number.isFinite(ballModifier) || ballModifier <= 0) {
    throw new Error(
      `capture: ballModifier must be a positive number, got ${ballModifier}`,
    );
  }
  validateHp(currentHp, maxHp);

  const raw = catchRate * hpModifier(currentHp, maxHp) * ballModifier;
  return Math.min(MAX_CAPTURE_CHANCE, Math.max(MIN_CAPTURE_CHANCE, raw));
}

export interface CaptureAttempt {
  success: boolean;
  /** the final clamped chance (0.15 - 0.95) */
  chance: number;
  /** the random roll in [0, 1) — success when roll < chance */
  roll: number;
  ballModifier: number;
}

export interface CaptureAttemptParams extends CaptureChanceParams {
  randomSource?: RandomSource;
}

/**
 * Perform one capture attempt.
 * Success condition: roll < chance (roll from the injected random source).
 */
export function attemptCapture(params: CaptureAttemptParams): CaptureAttempt {
  const chance = calculateCaptureChance(params);
  const source = params.randomSource;
  const roll = source ? source.next() : randomFloat(0, 1);
  return {
    success: roll < chance,
    chance,
    roll,
    ballModifier: params.ballModifier,
  };
}
