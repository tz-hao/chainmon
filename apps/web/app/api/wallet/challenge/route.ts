import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import {
  createWalletChallenge,
  WalletError,
} from "@/lib/services/wallet-service";
import { requireAuthenticatedTrainer, TrainerSessionError } from "@/lib/auth/trainer-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { trainerId?: string; address?: string };
  try {
    body = (await request.json()) as { trainerId?: string; address?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.trainerId) {
    return NextResponse.json({ error: "trainerId is required." }, { status: 400 });
  }

  try {
    const repository = await getRepository();
    let authenticatedTrainerId: string | null = null;
    try {
      authenticatedTrainerId = await requireAuthenticatedTrainer(repository);
    } catch (error) {
      if (!(error instanceof TrainerSessionError)) throw error;
    }
    if (authenticatedTrainerId && authenticatedTrainerId !== body.trainerId) {
      return NextResponse.json({ error: "Wallet session does not match this trainer." }, { status: 403 });
    }
    const boundWallet = await repository.getVerifiedWallet(body.trainerId);
    if (
      !authenticatedTrainerId &&
      boundWallet &&
      (!body.address || boundWallet !== body.address.toLowerCase())
    ) {
      return NextResponse.json({ error: "Sign with the wallet already bound to this trainer." }, { status: 401 });
    }
    const challenge = await createWalletChallenge(
      repository,
      authenticatedTrainerId ?? body.trainerId,
      body.address,
    );
    return NextResponse.json(challenge);
  } catch (error) {
    if (error instanceof WalletError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not create challenge." }, { status: 500 });
  }
}
