import { NextResponse } from "next/server";
import { requireAuthenticatedTrainer, TrainerSessionError } from "@/lib/auth/trainer-session";
import { getRepository } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Minimal private header profile; it never returns credentials or signatures. */
export async function GET() {
  try {
    const repository = await getRepository();
    const trainerId = await requireAuthenticatedTrainer(repository);
    const trainer = await repository.getTrainerById(trainerId);
    if (!trainer) throw new TrainerSessionError();
    const walletAddress = await repository.getVerifiedWallet(trainer.id);
    return NextResponse.json({
      trainer: { nickname: trainer.nickname, gold: trainer.gold },
      walletAddress,
    });
  } catch (error) {
    if (error instanceof TrainerSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Account temporarily unavailable." }, { status: 503 });
  }
}
