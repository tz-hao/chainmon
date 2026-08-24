import { generateEncounter, type WildEncounter } from "@chainmon/game-engine";
import { getRegionById } from "@chainmon/monster-data";
import type { GameRepository } from "@/lib/data";

export class ExploreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExploreError";
  }
}

/**
 * Explore → Encounter chain:
 *  - resolve the region
 *  - reuse an existing ACTIVE encounter (one at a time)
 *  - otherwise roll a weighted species and persist the encounter
 */
export async function exploreRegion(
  repository: GameRepository,
  trainerId: string,
  regionId: string,
): Promise<WildEncounter> {
  const region = getRegionById(regionId);
  if (!region) {
    throw new ExploreError("Region not found.");
  }

  const existing = await repository.getActiveEncounter(trainerId);
  if (existing) {
    return existing;
  }

  const encounter = generateEncounter(region, trainerId);
  await repository.createEncounter(encounter);
  return encounter;
}
