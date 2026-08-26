import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import { requireAuthenticatedTrainer, TrainerSessionError } from "@/lib/auth/trainer-session";
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
    const trainerId = await requireAuthenticatedTrainer(repository);
    const outcome = await throwBall(repository, {
      trainerId,
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
    if (error instanceof TrainerSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Capture temporarily unavailable." },
      { status: 503 },
    );
  }
}
