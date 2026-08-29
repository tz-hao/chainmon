import { NextResponse } from "next/server";
import type { BattleAction } from "@chainmon/game-engine";
import { getRepository } from "@/lib/data";
import {
  requireAuthenticatedTrainer,
  TrainerSessionError,
} from "@/lib/auth/trainer-session";
import {
  BattleError,
  submitBattleAction,
} from "@/lib/services/battle-service";

export const dynamic = "force-dynamic";

function parseAction(value: unknown): BattleAction | null {
  if (!value || typeof value !== "object") return null;
  const action = value as Record<string, unknown>;
  if (action.type === "basic_attack" || action.type === "defend") {
    return { type: action.type };
  }
  if (action.type === "skill" && typeof action.skillId === "string") {
    return { type: "skill", skillId: action.skillId };
  }
  if (action.type === "switch" && typeof action.targetBattleMonsterId === "string") {
    return { type: "switch", targetBattleMonsterId: action.targetBattleMonsterId };
  }
  return null;
}

export async function POST(request: Request) {
  let body: { battleId?: unknown; expectedTurn?: unknown; action?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const action = parseAction(body.action);
  if (
    typeof body.battleId !== "string" ||
    !body.battleId.startsWith("rift-battle-") ||
    !Number.isInteger(body.expectedTurn) ||
    !action
  ) {
    return NextResponse.json({ error: "Invalid Rift action." }, { status: 400 });
  }

  try {
    const repository = await getRepository();
    const trainerId = await requireAuthenticatedTrainer(repository);
    const result = await submitBattleAction(repository, {
      trainerId,
      battleId: body.battleId,
      expectedTurn: body.expectedTurn as number,
      action,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TrainerSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof BattleError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: "The battle action could not be resolved." }, { status: 400 });
    }
    return NextResponse.json({ error: "Rift action temporarily unavailable." }, { status: 503 });
  }
}
