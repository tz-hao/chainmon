import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import { createSiweChallenge, SiweAuthenticationError } from "@/lib/auth/siwe";

export const dynamic = "force-dynamic";

/** Create a server-owned, single-use EIP-4361 message for a connected wallet. */
export async function POST(request: Request) {
  let body: { address?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.address) {
    return NextResponse.json({ error: "A connected wallet address is required." }, { status: 400 });
  }

  try {
    const repository = await getRepository();
    const challenge = await createSiweChallenge(repository, request, body.address);
    return NextResponse.json(challenge);
  } catch (error) {
    if (error instanceof SiweAuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not start wallet login." }, { status: 503 });
  }
}
