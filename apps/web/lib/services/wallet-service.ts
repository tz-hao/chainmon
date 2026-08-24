import { randomUUID } from "crypto";
import { getAddress, recoverMessageAddress } from "viem";
import type { GameRepository } from "@/lib/data";

export class WalletError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletError";
  }
}

export const WALLET_NONCE_TTL_MS = 10 * 60 * 1000;

export interface WalletChallengeResult {
  message: string;
  expiresAt: string;
}

/**
 * Create a single-use, expiring wallet verification challenge.
 * The challenge embeds the claimed (connected) wallet address so the
 * signature can be bound to exactly that wallet.
 */
export async function createWalletChallenge(
  repository: GameRepository,
  trainerId: string,
  claimedAddress?: string,
): Promise<WalletChallengeResult> {
  const trainer = await repository.getDemoTrainer();
  if (!trainer || trainer.id !== trainerId) {
    throw new WalletError("Trainer not found.");
  }

  const nonce = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + WALLET_NONCE_TTL_MS);
  const bound = await repository.getVerifiedWallet(trainerId);

  let addressLine = "not-bound-yet";
  if (bound) {
    addressLine = bound;
  } else if (claimedAddress) {
    addressLine = getAddress(claimedAddress).toLowerCase();
  }

  const message = [
    "ChainMon Wallet Verification",
    `Trainer: ${trainerId}`,
    `Address: ${addressLine}`,
    `Nonce: ${nonce}`,
    `Issued At: ${now.toISOString()}`,
    `Expires At: ${expiresAt.toISOString()}`,
  ].join("\n");

  await repository.setWalletChallenge(trainerId, { nonce, expiresAt });
  return { message, expiresAt: expiresAt.toISOString() };
}

/**
 * Verify a wallet signature for the given challenge message and bind the
 * recovered address (canonical lowercase). Rules:
 *  - nonce must exist, be unexpired and match the message
 *  - the recovered address must equal the claimed (connected) wallet
 *  - the message must embed the claimed address
 *  - nonce is single-use (cleared on successful bind)
 *  - rebinding an already-verified wallet is rejected (MVP rule)
 */
export async function verifyWalletSignature(
  repository: GameRepository,
  trainerId: string,
  message: string,
  signature: string,
  claimedAddress: string,
): Promise<string> {
  const trainer = await repository.getDemoTrainer();
  if (!trainer || trainer.id !== trainerId) {
    throw new WalletError("Trainer not found.");
  }

  const challenge = await repository.getWalletChallenge(trainerId);
  if (!challenge) {
    throw new WalletError("No active challenge. Request a new one.");
  }
  if (new Date() > challenge.expiresAt) {
    throw new WalletError("Challenge expired. Request a new one.");
  }
  if (!message.includes(`Nonce: ${challenge.nonce}`)) {
    throw new WalletError("Challenge mismatch. Request a new one.");
  }

  const canonicalClaimed = getAddress(claimedAddress).toLowerCase();
  if (!message.includes(`Address: ${canonicalClaimed}`)) {
    throw new WalletError("Challenge mismatch. Request a new one.");
  }

  let recovered: `0x${string}`;
  try {
    recovered = await recoverMessageAddress({ message, signature: signature as `0x${string}` });
  } catch {
    throw new WalletError("Invalid signature.");
  }
  if (recovered.toLowerCase() !== canonicalClaimed) {
    throw new WalletError("Signature does not match the claimed wallet.");
  }

  const existing = await repository.getVerifiedWallet(trainerId);
  if (existing && existing !== canonicalClaimed) {
    throw new WalletError("Wallet rebinding is not supported yet.");
  }

  return repository.bindWallet(trainerId, canonicalClaimed);
}
