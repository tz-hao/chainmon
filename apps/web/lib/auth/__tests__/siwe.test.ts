import { privateKeyToAccount } from "viem/accounts";
import { beforeEach, describe, expect, it } from "vitest";
import { createSiweChallenge, SIWE_NONCE_TTL_MS, verifySiweChallenge } from "../siwe";
import { memoryRepository, resetMemoryRepository } from "../../data/memory-repository";

const WALLET_A = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const WALLET_B = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
);
const request = new Request("http://localhost:3000/api/auth/nonce", { method: "POST" });

beforeEach(() => resetMemoryRepository());

describe("wallet-first SIWE authentication", () => {
  it("creates a readable EIP-4361 message without signing on connect", async () => {
    const challenge = await createSiweChallenge(memoryRepository, request, WALLET_A.address);
    expect(challenge.message).toContain("localhost:3000 wants you to sign in with your Ethereum account:");
    expect(challenge.message).toContain("Sign in to ChainMon.");
    expect(challenge.message).toContain("URI: http://localhost:3000");
    expect(challenge.message).toContain("Chain ID: 10143");
    expect(challenge.message).toContain("Nonce: ");
    expect(challenge.message).toContain("Expiration Time: ");
  });

  it("does not let a forwarded request header choose the SIWE domain", async () => {
    const forwardedRequest = new Request(
      "http://localhost:3000/api/auth/nonce",
      {
        method: "POST",
        headers: {
          "x-forwarded-host": "evil.example",
          "x-forwarded-proto": "https",
        },
      },
    );
    const challenge = await createSiweChallenge(
      memoryRepository,
      forwardedRequest,
      WALLET_A.address,
    );
    expect(challenge.message).toContain("localhost:3000 wants you to sign in");
    expect(challenge.message).not.toContain("evil.example");
  });

  it("verifies a valid signature and restores the same wallet player", async () => {
    const challenge = await createSiweChallenge(memoryRepository, request, WALLET_A.address);
    const signature = await WALLET_A.signMessage({ message: challenge.message });
    const walletAddress = await verifySiweChallenge(memoryRepository, challenge.message, signature);
    expect(walletAddress).toBe(WALLET_A.address.toLowerCase());

    const first = await memoryRepository.upsertWalletPlayer(walletAddress);
    const returning = await memoryRepository.upsertWalletPlayer(walletAddress);
    expect(first.created).toBe(true);
    expect(returning).toEqual({ trainer: first.trainer, created: false });
  });

  it("rejects a signature made by a different wallet", async () => {
    const challenge = await createSiweChallenge(memoryRepository, request, WALLET_A.address);
    const signature = await WALLET_B.signMessage({ message: challenge.message });
    await expect(
      verifySiweChallenge(memoryRepository, challenge.message, signature),
    ).rejects.toThrow(/does not match/i);
  });

  it("rejects a wrong domain, nonce, and replay", async () => {
    const challenge = await createSiweChallenge(memoryRepository, request, WALLET_A.address);
    const signature = await WALLET_A.signMessage({ message: challenge.message });
    await expect(
      verifySiweChallenge(
        memoryRepository,
        challenge.message.replace("localhost:3000", "evil.example"),
        signature,
      ),
    ).rejects.toThrow();
    await expect(
      verifySiweChallenge(
        memoryRepository,
        challenge.message.replace(/Nonce: [A-Za-z0-9]+/, "Nonce: WrongNonce"),
        signature,
      ),
    ).rejects.toThrow();

    await expect(verifySiweChallenge(memoryRepository, challenge.message, signature)).resolves.toBe(
      WALLET_A.address.toLowerCase(),
    );
    await expect(
      verifySiweChallenge(memoryRepository, challenge.message, signature),
    ).rejects.toThrow();
  });

  it("rejects an expired challenge", async () => {
    const issuedAt = new Date("2026-08-26T00:00:00.000Z");
    const challenge = await createSiweChallenge(
      memoryRepository,
      request,
      WALLET_A.address,
      issuedAt,
    );
    const signature = await WALLET_A.signMessage({ message: challenge.message });
    await expect(
      verifySiweChallenge(
        memoryRepository,
        challenge.message,
        signature,
        new Date(issuedAt.getTime() + SIWE_NONCE_TTL_MS + 1),
      ),
    ).rejects.toThrow(/expired/i);
  });
});
