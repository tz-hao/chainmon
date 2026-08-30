import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { GameRepository } from "@/lib/data";

const COOKIE_NAME = "chainmon_trainer_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

interface TrainerSessionPayload {
  walletAddress: string;
  trainerId: string;
  expiresAt: number;
}

export class TrainerSessionError extends Error {
  constructor(message = "A verified wallet login session is required.") {
    super(message);
    this.name = "TrainerSessionError";
  }
}

function sessionSecret(): string {
  const configured = process.env.CHAINMON_SESSION_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new TrainerSessionError("CHAINMON_SESSION_SECRET is required in production.");
  }
  // Memory/demo mode only. Production is fail-closed above.
  return "chainmon-development-session-secret";
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", sessionSecret()).update(encodedPayload).digest("base64url");
}

export function createTrainerSessionToken(
  walletAddress: string,
  trainerId: string,
  now = Date.now(),
): string {
  const payload: TrainerSessionPayload = {
    walletAddress,
    trainerId,
    expiresAt: now + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function readTrainerSessionToken(token: string, now = Date.now()): TrainerSessionPayload {
  const [encoded, suppliedSignature, ...rest] = token.split(".");
  if (!encoded || !suppliedSignature || rest.length > 0) {
    throw new TrainerSessionError("Invalid wallet session.");
  }
  const expectedSignature = sign(encoded);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new TrainerSessionError("Invalid wallet session.");
  }
  let payload: TrainerSessionPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as TrainerSessionPayload;
  } catch {
    throw new TrainerSessionError("Invalid wallet session.");
  }
  if (!payload.walletAddress || !payload.trainerId || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= now) {
    throw new TrainerSessionError("Login session expired. Please sign in again.");
  }
  return payload;
}

export function setTrainerSessionCookie(
  response: NextResponse,
  walletAddress: string,
  trainerId: string,
): void {
  response.cookies.set(COOKIE_NAME, createTrainerSessionToken(walletAddress, trainerId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearTrainerSessionCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

/** Resolve identity from the signed cookie and persisted wallet→trainer link. */
export async function resolveTrainerSession(
  repository: GameRepository,
  token: string,
): Promise<string> {
  const payload = readTrainerSessionToken(token);
  const trainerId = await repository.getTrainerByWallet(payload.walletAddress);
  if (!trainerId || trainerId !== payload.trainerId) {
    throw new TrainerSessionError("Login session no longer matches this trainer.");
  }
  return trainerId;
}

export async function requireAuthenticatedTrainer(
  repository: GameRepository,
): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) throw new TrainerSessionError();
  return resolveTrainerSession(repository, token);
}
