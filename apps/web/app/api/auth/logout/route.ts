import { NextResponse } from "next/server";
import { clearTrainerSessionCookie } from "@/lib/auth/trainer-session";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearTrainerSessionCookie(response);
  return response;
}
