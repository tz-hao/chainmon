/**
 * @chainmon/game-engine — experience.ts
 * Level / EXP progression (Phase 5).
 *
 * EXP semantics (canonical):
 *   Monster.exp = EXP accumulated WITHIN the current level.
 *   Leveling up subtracts the required amount and keeps the remainder.
 *   At MAX_LEVEL (50) EXP is capped to 0.
 *
 *   requiredExp(level) = level × level × 100
 *   Lv1→2 needs 100 · Lv2→3 needs 400 · Lv3→4 needs 900 · Lv10 needs 10000
 */

export const MAX_LEVEL = 50;

export function getRequiredExp(level: number): number {
  if (!Number.isInteger(level) || level < 1) {
    throw new Error(`experience: level must be an integer >= 1, got ${level}`);
  }
  return level * level * 100;
}

export interface ExperienceResult {
  oldLevel: number;
  newLevel: number;
  oldExp: number;
  newExp: number;
  levelsGained: number;
}

/**
 * Apply expGained to (level, exp), looping through multiple level-ups.
 * Example: Lv1 EXP 0 + 700 → Lv3 EXP 200 (100 → Lv2, 400 → Lv3, 200 left).
 * At MAX_LEVEL, exp is set to 0 (cannot gain further levels).
 */
export function applyExperience(
  currentLevel: number,
  currentExp: number,
  expGained: number,
): ExperienceResult {
  if (!Number.isInteger(currentLevel) || currentLevel < 1) {
    throw new Error(`experience: currentLevel must be an integer >= 1, got ${currentLevel}`);
  }
  if (!Number.isFinite(currentExp) || currentExp < 0) {
    throw new Error(`experience: currentExp must be >= 0, got ${currentExp}`);
  }
  if (!Number.isFinite(expGained) || expGained < 0) {
    throw new Error(`experience: expGained must be >= 0, got ${expGained}`);
  }

  let level = currentLevel;
  let exp = currentExp + expGained;

  while (level < MAX_LEVEL) {
    const required = getRequiredExp(level);
    if (exp < required) break;
    exp -= required;
    level += 1;
  }

  if (level >= MAX_LEVEL) {
    exp = 0; // Level cap rule: Lv50 EXP = 0
  }

  return {
    oldLevel: currentLevel,
    newLevel: level,
    oldExp: currentExp,
    newExp: exp,
    levelsGained: level - currentLevel,
  };
}
