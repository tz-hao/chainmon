import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import {
  verifyWalletSignature,
  WalletError,
} from "@/lib/services/wallet-service";
import {
  setTrainerSessionCookie,
} from "@/lib/auth/trainer-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: {
    trainerId?: string;
    message?: string;
    signature?: string;
    address?: string;
  };
  try {
    body = (await request.json()) as {
      trainerId?: string;
      message?: string;
      signature?: string;
      address?: string;
    };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.trainerId || !body.message || !body.signature || !body.address) {
    return NextResponse.json(
      { error: "trainerId, message, signature and address are required." },
      { status: 400 },
    );
  }

  try {
    const repository = await getRepository();
    const existingWallet = await repository.getVerifiedWallet(body.trainerId);
    if (existingWallet && existingWallet !== body.address.toLowerCase()) {
      return NextResponse.json(
        { error: "Sign with the wallet already bound to this trainer." },
        { status: 403 },
      );
    }
    const bound = await verifyWalletSignature(
      repository,
      body.trainerId,
      body.message,
      body.signature,
      body.address,
    );
    const response = NextResponse.json({ walletAddress: bound });
    setTrainerSessionCookie(response, body.trainerId, bound);
    return response;
  } catch (error) {
    if (error instanceof WalletError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Wallet verification failed." }, { status: 500 });
  }
}
