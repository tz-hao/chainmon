import {
  checkEvolutionEligibility,
  EVOLUTION_ITEM_SLUGS,
  evolveMonsterData,
} from "@chainmon/game-engine";
import { getSpeciesById } from "@chainmon/monster-data";
import type { Monster } from "@chainmon/shared";
import type {
  EvolutionHistoryRecord,
  GameRepository,
} from "@/lib/data";
import { assertNotListed } from "./marketplace-service";

export class EvolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvolutionError";
  }
}

export interface EvolutionResult {
  monster: Monster;
  history: EvolutionHistoryRecord;
}

/**
 * Evolution chain (player-confirmed, never automatic):
 *  load monster → validate ownership → load species → validate level →
 *  validate item → consume item → change species → recalc stats/skills →
 *  persist + history (atomic via repository.commitEvolution).
 */
export async function evolveMonster(
  repository: GameRepository,
  trainerId: string,
  monsterId: string,
): Promise<EvolutionResult> {
  const monster = await repository.getMonster(monsterId);
  if (!monster) {
    throw new EvolutionError("Monster not found.");
  }
  if (monster.owner !== trainerId) {
    throw new EvolutionError("You don't own this monster.");
  }
  // Marketplace gameplay lock: listed monsters cannot evolve.
  await assertNotListed(repository, monsterId);

  const species = getSpeciesById(monster.speciesId);
  if (!species) {
    throw new EvolutionError("Unknown monster species.");
  }

  const inventory = await repository.getInventory(trainerId);
  const eligibility = checkEvolutionEligibility(monster, species, inventory);

  if (!eligibility.eligible) {
    if (eligibility.missingLevel !== undefined) {
      throw new EvolutionError(
        `This monster needs to reach Level ${eligibility.missingLevel} to evolve.`,
      );
    }
    if (eligibility.missingItem) {
      const name =
        Object.entries(EVOLUTION_ITEM_SLUGS).find(
          ([, slug]) => slug === eligibility.missingItem?.itemSlug,
        )?.[0] ?? eligibility.missingItem.itemSlug;
      throw new EvolutionError(
        `Evolution requires ${name} ×${eligibility.missingItem.quantity}.`,
      );
    }
    throw new EvolutionError("This monster cannot evolve.");
  }

  const target = getSpeciesById(eligibility.targetSpeciesId ?? -1);
  if (!target) {
    throw new EvolutionError("Evolution target is missing.");
  }

  const evolved = evolveMonsterData(monster, target);
  const consumedItemSlug = species.evolution?.item
    ? EVOLUTION_ITEM_SLUGS[species.evolution.item]
    : undefined;

  const result = await repository.commitEvolution({
    monsterId,
    trainerId,
    monster: evolved,
    fromSpeciesId: species.id,
    toSpeciesId: target.id,
    consumedItemSlug,
    level: monster.level,
  });

  if (result.status === "invalid") {
    throw new EvolutionError("This monster can no longer evolve.");
  }
  if (result.status === "no-item") {
    throw new EvolutionError("You don't have the required evolution item.");
  }

  return { monster: evolved, history: result.history };
}
