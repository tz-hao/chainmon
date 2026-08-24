/**
 * @chainmon/monster-data — regions.ts
 * Explore regions and their weighted encounter tables (Phase 3).
 *
 * ALL encounter probability is defined here — never inside React components.
 *
 * Weight design:
 *  - Common species: highest weight
 *  - Rare: below common
 *  - Epic: clearly lower
 *  - Legendary: extremely low (~1% or less)
 */

import type { Element } from "@chainmon/shared";

export interface RegionEncounter {
  speciesId: number;
  /** relative weight — must be > 0 */
  weight: number;
}

export interface Region {
  id: string;
  name: string;
  description: string;
  mainElement: Element;
  encounters: RegionEncounter[];
}

export const REGIONS: readonly Region[] = [
  {
    id: "forest",
    name: "Forest",
    description:
      "Dense woodland where Nature-type monsters roam. Leafy clearings hide both gentle cubs and ancient guardians.",
    mainElement: "nature",
    encounters: [
      { speciesId: 11, weight: 30 }, // LeafCat (common)
      { speciesId: 12, weight: 25 }, // BloomMantis (common)
      { speciesId: 13, weight: 16 }, // MossBear (rare)
      { speciesId: 14, weight: 8 }, // ThornDeer (epic)
      { speciesId: 15, weight: 1 }, // AncientTreant (legendary — extremely rare)
      { speciesId: 7, weight: 7 }, // BubbleFin (water, occasional visitor)
      { speciesId: 1, weight: 6 }, // FireCub (fire, rare visitor)
      { speciesId: 16, weight: 4 }, // SparkMouse (electric, rare visitor)
    ],
  },
  {
    id: "lake",
    name: "Lake",
    description:
      "Calm waters teeming with Water-type monsters. Deep below the surface, ancient predators drift.",
    mainElement: "water",
    encounters: [
      { speciesId: 6, weight: 30 }, // AquaTurtle (common)
      { speciesId: 7, weight: 26 }, // BubbleFin (common)
      { speciesId: 8, weight: 18 }, // TideOtter (rare)
      { speciesId: 9, weight: 9 }, // CoralSerpent (epic)
      { speciesId: 10, weight: 1 }, // AbyssShark (legendary — extremely rare)
    ],
  },
  {
    id: "volcano",
    name: "Volcano",
    description:
      "Molten caverns inhabited by Fire-type monsters. Only the brave venture close to the lava rivers.",
    mainElement: "fire",
    encounters: [
      { speciesId: 5, weight: 30 }, // MagmaBoar (common)
      { speciesId: 1, weight: 28 }, // FireCub (common)
      { speciesId: 4, weight: 16 }, // EmberFox (rare)
      { speciesId: 2, weight: 12 }, // FireWolf (rare)
      { speciesId: 3, weight: 3 }, // InfernoWolf (epic — clearly rarer)
    ],
  },
  {
    id: "power-plant",
    name: "Power Plant",
    description:
      "Humming turbines that attract Electric-type monsters. Stray sparks dance between the machinery.",
    mainElement: "electric",
    encounters: [
      { speciesId: 16, weight: 30 }, // SparkMouse (common)
      { speciesId: 17, weight: 28 }, // StaticLynx (common)
      { speciesId: 19, weight: 16 }, // VoltHare (rare)
      { speciesId: 18, weight: 12 }, // StormDragon (rare)
      { speciesId: 20, weight: 3 }, // ThunderBird (epic — clearly rarer)
    ],
  },
];

export function getRegionById(id: string): Region | undefined {
  return REGIONS.find((region) => region.id === id);
}
