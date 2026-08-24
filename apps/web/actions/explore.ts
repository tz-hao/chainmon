"use server";

import type { WildEncounter } from "@chainmon/game-engine";
import { redirect } from "next/navigation";
import { getRepository } from "@/lib/data";
import {
  ExploreError,
  exploreRegion,
} from "@/lib/services/explore-service";

export interface ExploreActionResult {
  error?: string;
}

export async function exploreAction(
  formData: FormData,
): Promise<ExploreActionResult> {
  const regionId = String(formData.get("regionId") ?? "");

  const repository = await getRepository();
  const trainer = await repository.getDemoTrainer();
  if (!trainer) {
    return { error: "Create a trainer first." };
  }

  let encounter: WildEncounter;
  try {
    encounter = await exploreRegion(repository, trainer.id, regionId);
  } catch (error) {
    return {
      error:
        error instanceof ExploreError
          ? error.message
          : "Exploration failed. Please try again.",
    };
  }

  redirect(`/encounter/${encounter.id}`);
}
