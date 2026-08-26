"use server";

import type { Monster } from "@chainmon/shared";
import { getCurrentTrainer } from "@/lib/auth/current-trainer";
import {
  EvolutionError,
  evolveMonster,
} from "@/lib/services/evolution-service";

export interface EvolveActionResult {
  ok: boolean;
  error?: string;
  monster?: Monster;
  history?: {
    id: string;
    monsterId: string;
    fromSpeciesId: number;
    toSpeciesId: number;
    level: number;
    createdAt: Date;
  };
}

export async function evolveMonsterAction(
  formData: FormData,
): Promise<EvolveActionResult> {
  const monsterId = String(formData.get("monsterId") ?? "");

  const { repository, trainer } = await getCurrentTrainer();

  try {
    const result = await evolveMonster(repository, trainer.id, monsterId);
    return {
      ok: true,
      monster: result.monster,
      history: result.history,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof EvolutionError
          ? error.message
          : "Evolution failed. Please try again.",
    };
  }
}
