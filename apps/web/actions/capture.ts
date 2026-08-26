"use server";

import { redirect } from "next/navigation";
import { getCurrentTrainer } from "@/lib/auth/current-trainer";
import {
  CaptureError,
  fleeEncounter,
  throwBall,
  type ThrowBallOutcome,
} from "@/lib/services/capture-service";

export interface ThrowBallActionResult {
  ok: boolean;
  error?: string;
  result?: ThrowBallOutcome;
}

export async function throwBallAction(
  formData: FormData,
): Promise<ThrowBallActionResult> {
  const encounterId = String(formData.get("encounterId") ?? "");
  const ballSlug = String(formData.get("ballSlug") ?? "");

  const { repository, trainer } = await getCurrentTrainer();

  try {
    const result = await throwBall(repository, {
      trainerId: trainer.id,
      encounterId,
      ballSlug,
    });
    return { ok: true, result };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof CaptureError
          ? error.message
          : "Capture failed. Please try again.",
    };
  }
}

export interface FleeActionResult {
  ok: boolean;
  error?: string;
}

export async function fleeAction(
  formData: FormData,
): Promise<FleeActionResult> {
  const encounterId = String(formData.get("encounterId") ?? "");

  const { repository, trainer } = await getCurrentTrainer();

  try {
    await fleeEncounter(repository, trainer.id, encounterId);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof CaptureError
          ? error.message
          : "Could not flee. Please try again.",
    };
  }

  redirect("/explore");
}
