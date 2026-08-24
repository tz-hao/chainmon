import { privateKeyToAccount } from "viem/accounts";
import { beforeEach, describe, expect, it } from "vitest";
import { createTrainerWithStarter } from "../../data/demo-service";
import { memoryRepository, resetMemoryRepository } from "../../data/memory-repository";
import type { GameRepository } from "../../data/types";
import {
  createWalletChallenge,
  verifyWalletSignature,
} from "../../services/wallet-service";

const PLAYER_KEY = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const OTHER_KEY = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
);

let repository: GameRepository;
let trainerId: string;

beforeEach(async () => {
  resetMemoryRepository();
  repository = memoryRepository;
  const { trainer } = await createTrainerWithStarter(
    repository,
    "Ash",
    "firecub",
  );
  trainerId = trainer.id;
});

async function sign(message: string) {
  return PLAYER_KEY.signMessage({ message });
}

describe("wallet challenge & verification", () => {
  it("binds a wallet with a valid signature (canonical lowercase)", async () => {
    const challenge = await createWalletChallenge(
      repository,
      trainerId,
      PLAYER_KEY.address,
    );
    expect(challenge.message).toContain("ChainMon Wallet Verification");
    expect(challenge.message).toContain(`Nonce: `);
    expect(challenge.message).toContain("Expires At: ");

    const signature = await sign(challenge.message);
    const bound = await verifyWalletSignature(
      repository,
      trainerId,
      challenge.message,
      signature,
      PLAYER_KEY.address,
    );
    expect(bound).toBe(PLAYER_KEY.address.toLowerCase());
    expect(await repository.getVerifiedWallet(trainerId)).toBe(
      PLAYER_KEY.address.toLowerCase(),
    );
  });

  it("rejects a signature that does not match the claimed address", async () => {
    // Challenge embeds OTHER's address; PLAYER signs it → recovered ≠ claimed
    const challenge = await createWalletChallenge(
      repository,
      trainerId,
      OTHER_KEY.address,
    );
    const signature = await sign(challenge.message);
    await expect(
      verifyWalletSignature(
        repository,
        trainerId,
        challenge.message,
        signature,
        OTHER_KEY.address, // claimed wallet ≠ signer
      ),
    ).rejects.toThrow(/does not match/i);
    expect(await repository.getVerifiedWallet(trainerId)).toBeNull();
  });

  it("rejects an expired nonce", async () => {
    await repository.setWalletChallenge(trainerId, {
      nonce: "stale-nonce",
      expiresAt: new Date(Date.now() - 1000),
    });
    const message = "ChainMon Wallet Verification\nNonce: stale-nonce";
    const signature = await sign(message);
    await expect(
      verifyWalletSignature(
        repository,
        trainerId,
        message,
        signature,
        PLAYER_KEY.address,
      ),
    ).rejects.toThrow(/expired/i);
  });

  it("rejects a used nonce (single use)", async () => {
    const challenge = await createWalletChallenge(repository, trainerId, PLAYER_KEY.address);
    const signature = await sign(challenge.message);
    await verifyWalletSignature(
      repository,
      trainerId,
      challenge.message,
      signature,
      PLAYER_KEY.address,
    );

    await expect(
      verifyWalletSignature(
        repository,
        trainerId,
        challenge.message,
        signature,
        PLAYER_KEY.address,
      ),
    ).rejects.toThrow(/No active challenge/i);
  });

  it("rejects a modified message (tampered nonce line)", async () => {
    const challenge = await createWalletChallenge(repository, trainerId, PLAYER_KEY.address);
    const signature = await sign(challenge.message);
    const tampered = challenge.message.replace("Nonce: ", "Nonce: tampered-");
    await expect(
      verifyWalletSignature(
        repository,
        trainerId,
        tampered,
        signature,
        PLAYER_KEY.address,
      ),
    ).rejects.toThrow(/Challenge mismatch/i);
  });

  it("rejects verification without a pending challenge", async () => {
    const signature = await sign("some random message");
    await expect(
      verifyWalletSignature(
        repository,
        trainerId,
        "some random message",
        signature,
        PLAYER_KEY.address,
      ),
    ).rejects.toThrow(/No active challenge/i);
  });

  it("rejects wallet rebinding after verification", async () => {
    const challenge = await createWalletChallenge(repository, trainerId, PLAYER_KEY.address);
    const signature = await sign(challenge.message);
    await verifyWalletSignature(
      repository,
      trainerId,
      challenge.message,
      signature,
      PLAYER_KEY.address,
    );

    // A different wallet tries to bind — same challenge is gone; new one
    // would embed the existing address, so signing with another key fails.
    const second = await createWalletChallenge(repository, trainerId, OTHER_KEY.address);
    const otherSignature = await OTHER_KEY.signMessage({
      message: second.message,
    });
    await expect(
      verifyWalletSignature(
        repository,
        trainerId,
        second.message,
        otherSignature,
        OTHER_KEY.address,
      ),
    ).rejects.toThrow(/Challenge mismatch|rebinding/i);
  });

  it("rejects challenges for an unknown trainer", async () => {
    await expect(
      createWalletChallenge(repository, "unknown-trainer"),
    ).rejects.toThrow(/Trainer not found/i);
  });
});
