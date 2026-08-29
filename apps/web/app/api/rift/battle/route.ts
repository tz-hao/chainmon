import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import {
  requireAuthenticatedTrainer,
  TrainerSessionError,
} from "@/lib/auth/trainer-session";
import {
  getRiftBattle,
  RiftError,
  startRiftBattle,
} from "@/lib/services/rift-service";
import { isRiftId } from "@/lib/rift/config";

export const dynamic = "force-dynamic";

function validShortText(value: unknown, maxLength = 120): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

export async function GET(request: Request) {
  const battleId = new URL(request.url).searchParams.get("battleId");
  if (!validShortText(battleId, 100)) {
    return NextResponse.json({ error: "battleId is required." }, { status: 400 });
  }

  try {
    const repository = await getRepository();
    const trainerId = await requireAuthenticatedTrainer(repository);
    const record = await getRiftBattle(repository, trainerId, battleId);
    return NextResponse.json(record);
  } catch (error) {
    if (error instanceof TrainerSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof RiftError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Rift battle temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let body: { riftId?: unknown; seed?: unknown; nodeId?: unknown; monsterIds?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (
    !isRiftId(body.riftId) ||
    !validShortText(body.seed) ||
    !validShortText(body.nodeId, 80) ||
    !Array.isArray(body.monsterIds) ||
    !body.monsterIds.every((value) => validShortText(value, 200))
  ) {
    return NextResponse.json({ error: "Invalid Rift battle request." }, { status: 400 });
  }

  try {
    const repository = await getRepository();
    const trainerId = await requireAuthenticatedTrainer(repository);
    const record = await startRiftBattle(repository, {
      trainerId,
      riftId: body.riftId,
      seed: body.seed,
      nodeId: body.nodeId,
      monsterIds: body.monsterIds,
    });
    return NextResponse.json(record);
  } catch (error) {
    if (error instanceof TrainerSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof RiftError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Rift battle temporarily unavailable." }, { status: 503 });
  }
}
