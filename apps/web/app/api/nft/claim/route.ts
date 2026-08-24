import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import {
  claimNft,
  ClaimError,
} from "@/lib/services/nft-claim-service";
import { getChainGateway } from "@/lib/web3";
import { requireAuthenticatedTrainer, TrainerSessionError } from "@/lib/auth/trainer-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { trainerId?: string; monsterId?: string };
  try {
    body = (await request.json()) as { trainerId?: string; monsterId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.monsterId) {
    return NextResponse.json(
      { error: "monsterId is required." },
      { status: 400 },
    );
  }

  try {
    const repository = await getRepository();
    const trainerId = await requireAuthenticatedTrainer(repository);
    if (body.trainerId && body.trainerId !== trainerId) {
      return NextResponse.json({ error: "Wallet session does not match this trainer." }, { status: 403 });
    }
    const gateway = getChainGateway();
    const result = await claimNft(repository, gateway, trainerId, body.monsterId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TrainerSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ClaimError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "NFT claim unavailable (blockchain temporarily unavailable)." },
      { status: 503 },
    );
  }
}
