import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import { requireAuthenticatedTrainer, TrainerSessionError } from "@/lib/auth/trainer-session";
import { validateWorldPosition } from "@/lib/services/world-service";
import { normalizeWorldMapId } from "@/lib/world/world-maps";

export const dynamic = "force-dynamic";

/**
 * POST /api/world/position — throttled player position save.
 * Called at most every 3-5s by the Phaser scene (throttle client-side).
 * Server clamps to sane bounds (the world is 64×48 tiles).
 */
export async function POST(request: Request) {
  let body: { x?: number; y?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const x = validateWorldPosition(body.x, 63);
  const y = validateWorldPosition(body.y, 47);
  if (x === null || y === null) {
    return NextResponse.json({ error: "x and y must be finite numbers." }, { status: 400 });
  }

  try {
    const repository = await getRepository();
    const trainerId = await requireAuthenticatedTrainer(repository);
    const current = await repository.getTrainerWorldPosition(trainerId);
    const worldMap = normalizeWorldMapId(current?.worldMap);
    await repository.saveTrainerWorldPosition(trainerId, {
      worldMap,
      worldX: x,
      worldY: y,
    });
    return NextResponse.json({ ok: true, x, y });
  } catch (error) {
    if (error instanceof TrainerSessionError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
