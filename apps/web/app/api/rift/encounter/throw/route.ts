import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import {
  requireAuthenticatedTrainer,
  TrainerSessionError,
} from "@/lib/auth/trainer-session";
import { CaptureError, throwBall } from "@/lib/services/capture-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { encounterId?: unknown; ballSlug?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (
    typeof body.encounterId !== "string" ||
    !body.encounterId.startsWith("rift-encounter-") ||
    typeof body.ballSlug !== "string" ||
    body.ballSlug.length > 80
  ) {
    return NextResponse.json({ error: "Invalid capture request." }, { status: 400 });
  }

  try {
    const repository = await getRepository();
    const trainerId = await requireAuthenticatedTrainer(repository);
    const outcome = await throwBall(repository, {
      trainerId,
      encounterId: body.encounterId,
      ballSlug: body.ballSlug,
    });
    const inventory = await repository.getInventory(trainerId);
    return NextResponse.json({
      outcome: outcome.outcome,
      chance: outcome.chance,
      monster:
        outcome.outcome === "captured"
          ? {
              id: outcome.monster.id,
              name: outcome.monster.name,
              speciesId: outcome.monster.speciesId,
            }
          : null,
      inventory,
    });
  } catch (error) {
    if (error instanceof TrainerSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof CaptureError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Capture temporarily unavailable." }, { status: 503 });
  }
}
