import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Current trainer wallet status (demo trainer). No trainerId required —
 * used by the wallet UI in the app shell.
 */
export async function GET() {
  try {
    const repository = await getRepository();
    const trainer = await repository.getDemoTrainer();
    if (!trainer) {
      return NextResponse.json({ trainerId: null, verified: false, walletAddress: null, nickname: null });
    }
    const wallet = await repository.getVerifiedWallet(trainer.id);
    return NextResponse.json({
      trainerId: trainer.id,
      nickname: trainer.nickname,
      verified: wallet !== null,
      walletAddress: wallet,
    });
  } catch {
    return NextResponse.json({ error: "Could not load wallet status." }, { status: 500 });
  }
}
