import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import { SiweAuthenticationError, verifySiweChallenge } from "@/lib/auth/siwe";
import { setTrainerSessionCookie } from "@/lib/auth/trainer-session";

export const dynamic = "force-dynamic";

/** Verify SIWE, consume its nonce, then restore or create the wallet player. */
export async function POST(request: Request) {
  let body: { message?: string; signature?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.message || !body.signature) {
    return NextResponse.json({ error: "message and signature are required." }, { status: 400 });
  }

  try {
    const repository = await getRepository();
    const walletAddress = await verifySiweChallenge(repository, body.message, body.signature);
    const player = await repository.upsertWalletPlayer(walletAddress);
    await repository.grantStarterSupply(player.trainer.id);
    await repository.grantStarterMonster(player.trainer.id);

    const response = NextResponse.json({
      ok: true,
      walletAddress,
      trainer: player.trainer,
      created: player.created,
    });
    setTrainerSessionCookie(response, walletAddress, player.trainer.id);
    return response;
  } catch (error) {
    if (error instanceof SiweAuthenticationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { ok: false, error: "Account setup is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
}
