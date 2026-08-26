import { NextResponse } from "next/server";
import { requireAuthenticatedTrainer, TrainerSessionError } from "@/lib/auth/trainer-session";
import { getRepository } from "@/lib/data";
import { buildWorldMap } from "@/lib/world/map-data";
import { isWorldMapId } from "@/lib/world/world-maps";

export const dynamic = "force-dynamic";

/** Switch only through the formal world selector and enter at a safe spawn point. */
export async function POST(request: Request) {
  let body: { worldMap?: string };
  try {
    body = (await request.json()) as { worldMap?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!isWorldMapId(body.worldMap)) {
    return NextResponse.json({ error: "Unknown world." }, { status: 400 });
  }

  try {
    const repository = await getRepository();
    const trainerId = await requireAuthenticatedTrainer(repository);
    const map = buildWorldMap(body.worldMap);
    await repository.saveTrainerWorldPosition(trainerId, {
      worldMap: body.worldMap,
      worldX: map.spawnPoint.x,
      worldY: map.spawnPoint.y,
    });
    return NextResponse.json({ ok: true, worldMap: body.worldMap, ...map.spawnPoint });
  } catch (error) {
    if (error instanceof TrainerSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: "World selection is temporarily unavailable." }, { status: 503 });
  }
}
