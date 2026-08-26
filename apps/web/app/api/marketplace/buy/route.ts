import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import {
  confirmSale,
  MarketplaceError,
} from "@/lib/services/marketplace-service";
import { getChainGateway } from "@/lib/web3";
import { requireAuthenticatedTrainer, TrainerSessionError } from "@/lib/auth/trainer-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: {
    monsterId?: string;
    txHash?: string;
    buyerWallet?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.monsterId || !body.txHash || !body.buyerWallet) {
    return NextResponse.json(
      { error: "monsterId, txHash and buyerWallet are required." },
      { status: 400 },
    );
  }

  try {
    const repository = await getRepository();
    const trainerId = await requireAuthenticatedTrainer(repository);
    const gateway = getChainGateway();
    const listing = await confirmSale(
      repository,
      gateway,
      trainerId,
      body.monsterId,
      body.txHash,
      body.buyerWallet,
    );
    return NextResponse.json(listing);
  } catch (error) {
    if (error instanceof TrainerSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof MarketplaceError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Marketplace temporarily unavailable." },
      { status: 503 },
    );
  }
}
