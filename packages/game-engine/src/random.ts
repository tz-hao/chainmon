/**
 * @chainmon/game-engine — random.ts
 * Single place for all randomness in ChainMon.
 * Never call Math.random() directly outside this module.
 *
 * Used by: DNA generation (Phase 2), encounter (Phase 3),
 *          capture rolls (Phase 3), battle rolls (Phase 4).
 */

export interface RandomSource {
  next(): number; // returns a float in [0, 1)
}

/** The plain Math.random-backed source (the reset target). */
const mathRandomSource: RandomSource = { next: () => Math.random() };

let currentSource: RandomSource = mathRandomSource;

/** Forwards to the active source (swappable for tests). */
export const defaultRandomSource: RandomSource = {
  next: () => currentSource.next(),
};

export function setRandomSource(source: RandomSource): void {
  currentSource = source;
}

export function resetRandomSource(): void {
  currentSource = mathRandomSource;
}

/**
 * Integer in [min, max] — both ends inclusive.
 */
export function randomInt(min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new Error(`randomInt: bounds must be integers, got [${min}, ${max}]`);
  }
  if (min > max) {
    throw new Error(`randomInt: min (${min}) must not exceed max (${max})`);
  }
  return Math.floor(currentSource.next() * (max - min + 1)) + min;
}

/**
 * Float in [min, max).
 */
export function randomFloat(
  min: number,
  max: number,
  randomSource: RandomSource = currentSource,
): number {
  if (min > max) {
    throw new Error(`randomFloat: min (${min}) must not exceed max (${max})`);
  }
  return randomSource.next() * (max - min) + min;
}

/**
 * Random element of a non-empty array.
 */
export function randomChoice<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("randomChoice: cannot choose from an empty array");
  }
  const index = randomInt(0, items.length - 1);
  const item = items[index];
  if (item === undefined) {
    throw new Error("randomChoice: unexpected undefined item");
  }
  return item;
}

export interface WeightedEntry<T> {
  value: T;
  weight: number;
}

/**
 * Weighted random selection.
 *
 * - Every weight must be a positive finite number (throws otherwise).
 * - Empty input throws a clear error.
 * - The input array is never mutated.
 * - A RandomSource can be injected for deterministic tests.
 */
export function weightedRandom<T>(
  entries: readonly WeightedEntry<T>[],
  randomSource: RandomSource = currentSource,
): T {
  if (entries.length === 0) {
    throw new Error("weightedRandom: cannot pick from an empty entry list");
  }

  let total = 0;
  for (const entry of entries) {
    if (!Number.isFinite(entry.weight) || entry.weight <= 0) {
      throw new Error(
        `weightedRandom: every weight must be a positive number, got ${entry.weight}`,
      );
    }
    total += entry.weight;
  }

  let roll = randomSource.next() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll < 0) {
      return entry.value;
    }
  }
  // Floating-point safety net: land on the last entry.
  return entries[entries.length - 1]!.value;
}

/**
 * Random id (UUID when the platform provides it, otherwise generated).
 */
export function randomId(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj !== undefined && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  return `mon-${Date.now().toString(36)}-${randomInt(100000, 999999)}`;
}
