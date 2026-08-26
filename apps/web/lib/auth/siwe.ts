import "server-only";

import { randomUUID } from "crypto";
import { getAddress, recoverMessageAddress } from "viem";
import {
  createSiweMessage,
  generateSiweNonce,
  parseSiweMessage,
  validateSiweMessage,
} from "viem/siwe";
import { CHAINMON_CHAIN_ID } from "@/lib/web3/chain";
import type { GameRepository } from "@/lib/data";
import type { WalletLoginChallenge } from "@/lib/data";

export class SiweAuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiweAuthenticationError";
  }
}

export const SIWE_NONCE_TTL_MS = 10 * 60 * 1000;

function requestOrigin(request: Request): string {
  const configuredOrigin = process.env.CHAINMON_APP_ORIGIN;
  const vercelOrigin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : undefined;
  // Vercel injects VERCEL_URL from deployment metadata. Do not accept
  // x-forwarded-host/proto here: a client must not choose the SIWE domain.
  const origin = configuredOrigin ?? vercelOrigin ?? new URL(request.url).origin;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new SiweAuthenticationError("Wallet login origin is misconfigured.");
  }
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new SiweAuthenticationError("Wallet login requires an HTTPS origin.");
  }
  return parsed.origin;
}

function canonicalWalletAddress(address: string): string {
  try {
    return getAddress(address).toLowerCase();
  } catch {
    throw new SiweAuthenticationError("Connect a valid EVM wallet first.");
  }
}

export interface SiweChallengeResponse {
  message: string;
  expiresAt: string;
}

/**
 * Build and persist a readable, server-owned EIP-4361 challenge. The client
 * can provide only the wallet address; origin, URI, chain, nonce and lifetime
 * always originate on the server.
 */
export async function createSiweChallenge(
  repository: GameRepository,
  request: Request,
  walletAddress: string,
  now = new Date(),
): Promise<SiweChallengeResponse> {
  const address = canonicalWalletAddress(walletAddress);
  const origin = requestOrigin(request);
  const expiresAt = new Date(now.getTime() + SIWE_NONCE_TTL_MS);
  const nonce = generateSiweNonce();
  const message = createSiweMessage({
    domain: new URL(origin).host,
    address: getAddress(address),
    statement:
      "Sign in to ChainMon. This signature only verifies wallet ownership. It does not send a transaction, spend MON, approve tokens or NFTs, or transfer assets.",
    uri: origin,
    version: "1",
    chainId: CHAINMON_CHAIN_ID,
    nonce,
    issuedAt: now,
    expirationTime: expiresAt,
  });
  const challenge: WalletLoginChallenge = {
    id: randomUUID(),
    address,
    nonce,
    message,
    expiresAt,
  };
  await repository.createWalletLoginChallenge(challenge);
  return { message, expiresAt: expiresAt.toISOString() };
}

/** Verify all EIP-4361 fields plus the EIP-191 signature before consuming nonce. */
export async function verifySiweChallenge(
  repository: GameRepository,
  message: string,
  signature: string,
  now = new Date(),
): Promise<string> {
  const parsed = parseSiweMessage(message);
  if (!parsed.nonce) {
    throw new SiweAuthenticationError("Invalid Sign-In with Ethereum message.");
  }
  const challenge = await repository.getWalletLoginChallenge(parsed.nonce);
  if (!challenge || challenge.expiresAt <= now) {
    throw new SiweAuthenticationError("Login request expired. Request a new signature.");
  }
  if (challenge.message !== message) {
    throw new SiweAuthenticationError("Login request does not match the server challenge.");
  }

  const address = canonicalWalletAddress(challenge.address);
  const expected = parseSiweMessage(challenge.message);
  if (
    !expected.domain ||
    !expected.uri ||
    !expected.chainId ||
    !expected.issuedAt ||
    !expected.expirationTime
  ) {
    throw new SiweAuthenticationError("Stored login request is invalid.");
  }
  if (!validateSiweMessage({
    address: getAddress(address),
    domain: expected.domain,
    nonce: challenge.nonce,
    message: parsed,
    time: now,
  }) ||
    parsed.chainId !== CHAINMON_CHAIN_ID ||
    parsed.chainId !== expected.chainId ||
    parsed.uri !== expected.uri ||
    parsed.issuedAt?.getTime() !== expected.issuedAt.getTime() ||
    parsed.expirationTime?.getTime() !== expected.expirationTime.getTime()) {
    throw new SiweAuthenticationError("Invalid Sign-In with Ethereum fields.");
  }

  let recovered: `0x${string}`;
  try {
    recovered = await recoverMessageAddress({
      message,
      signature: signature as `0x${string}`,
    });
  } catch {
    throw new SiweAuthenticationError("Invalid wallet signature.");
  }
  if (recovered.toLowerCase() !== address) {
    throw new SiweAuthenticationError("The signature does not match the connected wallet.");
  }
  if (!(await repository.consumeWalletLoginChallenge(challenge.id, now))) {
    throw new SiweAuthenticationError("This login request was already used. Request a new signature.");
  }
  return address;
}
