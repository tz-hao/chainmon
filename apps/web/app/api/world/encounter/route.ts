import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import { startWorldEncounter, WorldError } from "@/lib/services/world-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/world/encounter — start an encounter from a world spawn.
 * Body: { spawnId }. The client never submits species/rarity/level.
 */
export async function POST(request: Request) {
  let body: { spawnId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.spawnId) {
    return NextResponse.json({ error: "spawnId is required." }, { status: 400 });
  }

  try {
    const repository = await getRepository();
    const trainer = await repository.getDemoTrainer();
    if (!trainer) {
      return NextResponse.json({ error: "Create a trainer first." }, { status: 400 });
    }
    const result = await startWorldEncounter(repository, {
      trainerId: trainer.id,
      spawnId: body.spawnId,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WorldError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "World temporarily unavailable." },
      { status: 503 },
    );
  }
}
