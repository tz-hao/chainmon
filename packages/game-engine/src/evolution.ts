/**
 * @chainmon/game-engine — evolution.ts
 * Evolution rules (Phase 5). Reuses the Phase 2 species data:
 *   evolution = { evolvesFrom?, evolvesTo?, level?, item? }
 *
 * - Evolution is NEVER automatic: the player confirms it on the detail page.
 * - DNA is preserved exactly (never regenerated).
 * - Identity is preserved: id, owner, generation, level, exp, battleCount, wins.
 * - Stats are recomputed from the target species + same DNA + current level.
 */

import type { Monster, Skill } from "@chainmon/shared";
import {
  getSkillById,
  type MonsterSpeciesData,
} from "@chainmon/monster-data";
import { calculateMonsterStats } from "./stats";

/** Human-readable evolution item → item slug (seed uses the same slugs). */
export const EVOLUTION_ITEM_SLUGS: Record<string, string> = {
  "Fire Stone": "fire-stone",
};

export interface EvolutionEligibility {
  eligible: boolean;
  targetSpeciesId?: number;
  missingLevel?: number;
  missingItem?: { itemSlug: string; quantity: number };
}

export interface InventoryItemView {
  slug: string;
  quantity: number;
}

export function checkEvolutionEligibility(
  monster: Pick<Monster, "level" | "speciesId">,
  species: MonsterSpeciesData,
  inventory: readonly InventoryItemView[],
): EvolutionEligibility {
  const evolution = species.evolution;
  if (!evolution?.evolvesTo) {
    return { eligible: false };
  }

  const requiredLevel = evolution.level ?? 1;
  if (monster.level < requiredLevel) {
    return {
      eligible: false,
      targetSpeciesId: evolution.evolvesTo,
      missingLevel: requiredLevel,
    };
  }

  if (evolution.item) {
    const itemSlug = EVOLUTION_ITEM_SLUGS[evolution.item];
    if (itemSlug) {
      const quantity = inventory.find((i) => i.slug === itemSlug)?.quantity ?? 0;
      if (quantity < 1) {
        return {
          eligible: false,
          targetSpeciesId: evolution.evolvesTo,
          missingItem: { itemSlug, quantity: 1 },
        };
      }
    }
  }

  return { eligible: true, targetSpeciesId: evolution.evolvesTo };
}

/**
 * Compute the evolved monster data (pure). DNA / id / owner / generation /
 * level / exp / battleCount / wins are preserved. Skills are merged from the
 * target species (unlockLevel <= current level, not already known, max 4).
 */
export function evolveMonsterData(
  monster: Monster,
  target: MonsterSpeciesData,
): Monster {
  const stats = calculateMonsterStats(target, monster.dna, monster.level);

  const ownedIds = new Set(monster.skills.map((skill) => skill.id));
  const newSkills: Skill[] = target.learnableSkills
    .filter(
      (entry) =>
        entry.unlockLevel <= monster.level && !ownedIds.has(entry.skillId),
    )
    .map((entry) => getSkillById(entry.skillId))
    .filter((skill): skill is Skill => skill !== undefined);

  return {
    ...monster,
    speciesId: target.id,
    name: target.name,
    element: target.element,
    rarity: target.rarity,
    hp: stats.hp,
    attack: stats.attack,
    defense: stats.defense,
    speed: stats.speed,
    skills: [...monster.skills, ...newSkills].slice(0, 4),
  };
}
