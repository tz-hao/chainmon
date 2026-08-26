import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import { requireAuthenticatedTrainer, TrainerSessionError } from "@/lib/auth/trainer-session";
import { fleeEncounter, CaptureError } from "@/lib/services/capture-service";

export const dynamic = "force-dynamic";

/** End the current trainer's active world encounter. */
export async function POST(request: Request) {
  let body: { encounterId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.encounterId) {
    return NextResponse.json({ error: "encounterId is required." }, { status: 400 });
  }

  try {
    const repository = await getRepository();
    const trainerId = await requireAuthenticatedTrainer(repository);
    await fleeEncounter(repository, trainerId, body.encounterId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof CaptureError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof TrainerSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: "World temporarily unavailable." }, { status: 503 });
  }
}
