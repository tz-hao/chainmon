/**
 * @chainmon/game-engine — elements.ts
 * Element advantage chart (Phase 4).
 *
 *   Fire > Nature · Nature > Water · Water > Fire · Electric > Water
 *
 * Multipliers: advantage 1.5x · resisted 0.75x · neutral 1.0x
 * Never write element logic inside battle UI components.
 */

import type { Element } from "@chainmon/shared";

export const ELEMENT_MULTIPLIER_ADVANTAGE = 1.5;
export const ELEMENT_MULTIPLIER_RESIST = 0.75;
export const ELEMENT_MULTIPLIER_NEUTRAL = 1.0;

/** attacker → defender it is strong against */
const ADVANTAGE: Record<Element, Element> = {
  fire: "nature",
  water: "fire",
  nature: "water",
  electric: "water",
};

export function getElementMultiplier(
  attacker: Element,
  defender: Element,
): number {
  if (ADVANTAGE[attacker] === defender) {
    return ELEMENT_MULTIPLIER_ADVANTAGE;
  }
  if (ADVANTAGE[defender] === attacker) {
    return ELEMENT_MULTIPLIER_RESIST;
  }
  return ELEMENT_MULTIPLIER_NEUTRAL;
}
