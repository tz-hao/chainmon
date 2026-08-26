import { describe, expect, it } from "vitest";
import {
  createTrainerSessionToken,
  readTrainerSessionToken,
  resolveTrainerSession,
  TrainerSessionError,
} from "../trainer-session";
import {
  memoryRepository,
  resetMemoryRepository,
} from "../../data/memory-repository";
import type { GameRepository } from "../../data/types";

const WALLET_A = "0x00000000000000000000000000000000000000a1";
const WALLET_B = "0x00000000000000000000000000000000000000b2";

describe("trainer wallet session token", () => {
  it("binds the signed session to one wallet identity and trainer", () => {
    const token = createTrainerSessionToken(WALLET_A, "trainer-a", 1_000);
    expect(readTrainerSessionToken(token, 1_001)).toMatchObject({
      trainerId: "trainer-a",
      walletAddress: WALLET_A,
    });
  });

  it("rejects tampering and expired tokens", () => {
    const token = createTrainerSessionToken(WALLET_A, "trainer-a", 1_000);
    expect(() => readTrainerSessionToken(`${token}x`, 1_001)).toThrow(TrainerSessionError);
    expect(() => readTrainerSessionToken(token, 1_000 + 12 * 60 * 60 * 1000)).toThrow(/expired/i);
  });

  it("does not let a token name a trainer that differs from its persisted identity", async () => {
    resetMemoryRepository();
    const player = await memoryRepository.upsertWalletPlayer(WALLET_A);
    const token = createTrainerSessionToken(WALLET_A, player.trainer.id);
    expect(await resolveTrainerSession(memoryRepository, token)).toBe(player.trainer.id);
    const forged = createTrainerSessionToken(WALLET_A, "trainer-b");
    await expect(resolveTrainerSession(memoryRepository, forged)).rejects.toThrow(/no longer matches/i);
  });

  it("keeps two authenticated identities isolated from each other's trainer session", async () => {
    const trainers = new Map([
      [WALLET_A, "trainer-a"],
      [WALLET_B, "trainer-b"],
    ]);
    const repository = {
      getTrainerByWallet: async (walletAddress: string) =>
        trainers.get(walletAddress.toLowerCase()) ?? null,
    } as unknown as GameRepository;

    const tokenA = createTrainerSessionToken(WALLET_A, "trainer-a");
    const tokenB = createTrainerSessionToken(WALLET_B, "trainer-b");
    expect(await resolveTrainerSession(repository, tokenA)).toBe("trainer-a");
    expect(await resolveTrainerSession(repository, tokenB)).toBe("trainer-b");

    const crossAccountToken = createTrainerSessionToken(WALLET_A, "trainer-b");
    await expect(resolveTrainerSession(repository, crossAccountToken)).rejects.toThrow(/no longer matches/i);
  });
});
