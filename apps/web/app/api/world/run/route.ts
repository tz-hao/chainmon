import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import { fleeEncounter, CaptureError } from "@/lib/services/capture-service";

export const dynamic = "force-dynamic";

/** End the current demo trainer's active world encounter. */
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
    const trainer = await repository.getDemoTrainer();
    if (!trainer) {
      return NextResponse.json({ error: "Create a trainer first." }, { status: 400 });
    }
    await fleeEncounter(repository, trainer.id, body.encounterId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof CaptureError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "World temporarily unavailable." }, { status: 503 });
  }
}
