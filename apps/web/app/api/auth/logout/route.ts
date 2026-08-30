import { NextResponse } from "next/server";
import { clearTrainerSessionCookie } from "@/lib/auth/trainer-session";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  clearTrainerSessionCookie(response);
  return response;
}
