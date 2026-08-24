"use server";

import { redirect } from "next/navigation";
import type { BattleState } from "@chainmon/game-engine";
import { getRepository } from "@/lib/data";
import {
  BattleError,
  createBattle,
  saveBattleTeam,
} from "@/lib/services/battle-service";

export interface SaveTeamActionResult {
  ok: boolean;
  error?: string;
}

export async function saveTeamAction(
  formData: FormData,
): Promise<SaveTeamActionResult> {
  const monsterIds = [
    String(formData.get("slot1") ?? ""),
    String(formData.get("slot2") ?? ""),
    String(formData.get("slot3") ?? ""),
  ];

  const repository = await getRepository();
  const trainer = await repository.getDemoTrainer();
  if (!trainer) {
    return { ok: false, error: "Create a trainer first." };
  }

  try {
    await saveBattleTeam(repository, trainer.id, monsterIds);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof BattleError
          ? error.message
          : "Could not save your team.",
    };
  }

  redirect("/battle");
}

export interface StartBattleActionResult {
  ok: boolean;
  error?: string;
}

export async function startBattleAction(): Promise<StartBattleActionResult> {
  const repository = await getRepository();
  const trainer = await repository.getDemoTrainer();
  if (!trainer) {
    return { ok: false, error: "Create a trainer first." };
  }

  let battle: BattleState;
  try {
    battle = await createBattle(repository, trainer.id);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof BattleError
          ? error.message
          : "Could not start the battle.",
    };
  }

  redirect(`/battle/${battle.id}`);
}
