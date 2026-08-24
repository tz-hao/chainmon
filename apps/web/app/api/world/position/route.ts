import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import { validateWorldPosition } from "@/lib/services/world-service";

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
    const trainer = await repository.getDemoTrainer();
    if (!trainer) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    await repository.saveTrainerWorldPosition(trainer.id, {
      worldMap: "chainmon-valley",
      worldX: x,
      worldY: y,
    });
    return NextResponse.json({ ok: true, x, y });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
