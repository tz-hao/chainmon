/**
 * ChainMon Pixel World — monster visual manifest.
 * Canonical registry: speciesId → the three shipped PNG render variants.
 * All UI and Phaser lookups go through here; visual components must never
 * fall back to the legacy SVG or draw substitute monsters at runtime.
 */

import {
  getEvolutionStage,
  getSpeciesById,
  MONSTER_SPECIES,
} from "@chainmon/monster-data";

export type MonsterVisualKind = "overworld" | "battle-front" | "portrait";
export type PixelRenderingMode = "pixelated";

/** Native asset dimensions. Display code may only use an integer scale. */
export const MONSTER_VISUAL_DIMENSIONS: Record<MonsterVisualKind, number> = {
  overworld: 32,
  "battle-front": 64,
  portrait: 128,
};

export interface MonsterVisualEntry {
  speciesId: number;
  slug: string;
  displayName: string;
  /** 1-based position in its real evolution line; unrelated species stay at stage 1. */
  evolutionStage: 1 | 2 | 3;
  overworld: string;
  battleFront: string;
  portrait: string;
  pixelRenderingMode: PixelRenderingMode;
}

function pad3(id: number): string {
  return String(id).padStart(3, "0");
}

/** Immutable manifest for the 28 canonical species and their 84 shipped PNGs. */
export const MONSTER_VISUALS: readonly MonsterVisualEntry[] = Array.from(
  { length: 28 },
  (_, i) => {
    const speciesId = i + 1;
    const species = getSpeciesById(speciesId);
    if (!species) {
      throw new Error(`monster-visuals: missing canonical species ${speciesId}`);
    }
    const slug = species.slug;
    const base = `/game/monsters/${pad3(speciesId)}-${slug}`;
    return {
      speciesId,
      slug,
      displayName: species.name,
      evolutionStage: Math.min(3, getEvolutionStage(species) + 1) as 1 | 2 | 3,
      overworld: `${base}/overworld.png`,
      battleFront: `${base}/battle-front.png`,
      portrait: `${base}/portrait.png`,
      pixelRenderingMode: "pixelated",
    };
  },
);

export function getVisualBySpeciesId(speciesId: number): MonsterVisualEntry {
  const entry = MONSTER_VISUALS.find((v) => v.speciesId === speciesId);
  if (!entry) throw new Error(`monster-visuals: unknown speciesId ${speciesId}`);
  return entry;
}

export function getMonsterVisualPath(
  speciesId: number,
  kind: MonsterVisualKind,
): string {
  const entry = getVisualBySpeciesId(speciesId);
  switch (kind) {
    case "overworld":
      return entry.overworld;
    case "battle-front":
      return entry.battleFront;
    case "portrait":
      return entry.portrait;
  }
}

/** Return the real stage sequence for a species without inventing unrelated forms. */
export function getEvolutionVisualLine(speciesId: number): readonly MonsterVisualEntry[] {
  let species = getSpeciesById(speciesId);
  if (!species) throw new Error(`monster-visuals: unknown speciesId ${speciesId}`);

  while (species.evolution?.evolvesFrom !== undefined) {
    const previous = getSpeciesById(species.evolution.evolvesFrom);
    if (!previous) break;
    species = previous;
  }

  const line: MonsterVisualEntry[] = [];
  let cursor: typeof species | undefined = species;
  while (cursor) {
    line.push(getVisualBySpeciesId(cursor.id));
    cursor = cursor.evolution?.evolvesTo
      ? getSpeciesById(cursor.evolution.evolvesTo)
      : undefined;
  }
  return line;
}

/** Compile-time guard that the registry mirrors the canonical 28-species data set. */
if (MONSTER_VISUALS.length !== MONSTER_SPECIES.length) {
  throw new Error("monster-visuals: registry/species count mismatch");
}
