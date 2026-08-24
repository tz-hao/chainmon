/**
 * @chainmon/game-engine — encounter.ts
 * Generates server-side wild encounters from a Region's weighted table.
 *
 * Phase 3 rules:
 *  - level is always 1 (no random leveling yet)
 *  - wild monsters are always at full HP (currentHp === maxHp)
 *  - NO Monster instance is created here — only after a successful capture
 *    does the capture flow call generateMonster().
 */

import type { Element, Rarity } from "@chainmon/shared";
import { getSpeciesById, type Region } from "@chainmon/monster-data";
import { randomId, weightedRandom } from "./random";

export type EncounterStatus = "active" | "captured" | "fled";

export interface WildEncounter {
  id: string;
  trainerId: string;
  regionId: string;
  speciesId: number;
  speciesName: string;
  element: Element;
  rarity: Rarity;
  level: number;
  currentHp: number;
  maxHp: number;
  status: EncounterStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerateEncounterOptions {
  id?: string;
  now?: Date;
}

/**
 * Roll a species from the region's weighted table and build the encounter.
 * maxHp uses the species' base HP at level 1 (DNA is only generated on capture).
 */
export function generateEncounter(
  region: Region,
  trainerId: string,
  options: GenerateEncounterOptions = {},
): WildEncounter {
  const entry = weightedRandom(
    region.encounters.map((e) => ({ value: e, weight: e.weight })),
  );
  const species = getSpeciesById(entry.speciesId);
  if (!species) {
    throw new Error(
      `generateEncounter: region "${region.id}" references unknown species ${entry.speciesId}`,
    );
  }

  const level = 1;
  const maxHp = species.baseHp; // level-1 base HP; DNA not generated before capture
  const now = options.now ?? new Date();

  return {
    id: options.id ?? randomId(),
    trainerId,
    regionId: region.id,
    speciesId: species.id,
    speciesName: species.name,
    element: species.element,
    rarity: species.rarity,
    level,
    currentHp: maxHp,
    maxHp,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}
