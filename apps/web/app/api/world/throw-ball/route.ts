import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import { throwBall, CaptureError } from "@/lib/services/capture-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/world/throw-ball — one capture attempt inside the Pixel World.
 * Reuses the existing capture service (atomic ball consumption + capture
 * roll). On failure the encounter STAYS ACTIVE so the player can keep
 * throwing; only Run (flee) ends it.
 *
 * Body: { encounterId, ballSlug }
 */
export async function POST(request: Request) {
  let body: { encounterId?: string; ballSlug?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.encounterId || !body.ballSlug) {
    return NextResponse.json(
      { error: "encounterId and ballSlug are required." },
      { status: 400 },
    );
  }

  try {
    const repository = await getRepository();
    const trainer = await repository.getDemoTrainer();
    if (!trainer) {
      return NextResponse.json({ error: "Create a trainer first." }, { status: 400 });
    }
    const outcome = await throwBall(repository, {
      trainerId: trainer.id,
      encounterId: body.encounterId,
      ballSlug: body.ballSlug,
    });
    return NextResponse.json({
      outcome: outcome.outcome,
      chance: outcome.chance,
      roll: outcome.roll,
      monster:
        outcome.outcome === "captured"
          ? { id: outcome.monster.id, name: outcome.monster.name }
          : null,
    });
  } catch (error) {
    if (error instanceof CaptureError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Capture temporarily unavailable." },
      { status: 503 },
    );
  }
}
