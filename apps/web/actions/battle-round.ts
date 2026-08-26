"use server";

import type {
  BattleAction,
  BattleLogEntry,
  BattleState,
} from "@chainmon/game-engine";
import type { BattleRewardSettlement } from "@/lib/data";
import { getCurrentTrainer } from "@/lib/auth/current-trainer";
import {
  BattleError,
  submitBattleAction,
} from "@/lib/services/battle-service";

export interface SubmitActionResult {
  ok: boolean;
  error?: string;
  state?: BattleState;
  logs?: BattleLogEntry[];
  rewards?: BattleRewardSettlement | null;
}

export interface SubmitActionInput {
  battleId: string;
  expectedTurn: number;
  action: BattleAction;
}

/**
 * Clients submit ONLY { battleId, expectedTurn, action }.
 * All stats, skills, damage, AI actions and the winner are computed
 * server-side inside the storage transaction.
 */
export async function submitAction(
  input: SubmitActionInput,
): Promise<SubmitActionResult> {
  const { repository, trainer } = await getCurrentTrainer();

  try {
    const result = await submitBattleAction(repository, {
      trainerId: trainer.id,
      battleId: input.battleId,
      expectedTurn: input.expectedTurn,
      action: input.action,
    });
    return { ok: true, state: result.state, logs: result.logs, rewards: result.rewards };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof BattleError
          ? error.message
          : "Battle failed. Please try again.",
    };
  }
}
