import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import {
  requireAuthenticatedTrainer,
  TrainerSessionError,
} from "@/lib/auth/trainer-session";
import { RiftError, startRiftEncounter } from "@/lib/services/rift-service";
import { isRiftId } from "@/lib/rift/config";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { riftId?: unknown; seed?: unknown; nodeId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (
    !isRiftId(body.riftId) ||
    typeof body.seed !== "string" ||
    body.seed.length < 1 ||
    body.seed.length > 120 ||
    typeof body.nodeId !== "string" ||
    body.nodeId.length < 1 ||
    body.nodeId.length > 80
  ) {
    return NextResponse.json({ error: "Invalid Rift encounter request." }, { status: 400 });
  }

  try {
    const repository = await getRepository();
    const trainerId = await requireAuthenticatedTrainer(repository);
    const encounter = await startRiftEncounter(repository, {
      trainerId,
      riftId: body.riftId,
      seed: body.seed,
      nodeId: body.nodeId,
    });
    const inventory = await repository.getInventory(trainerId);
    return NextResponse.json({ encounter, inventory });
  } catch (error) {
    if (error instanceof TrainerSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof RiftError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Rift encounter temporarily unavailable." }, { status: 503 });
  }
}
