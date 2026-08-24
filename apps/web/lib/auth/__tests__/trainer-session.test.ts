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
  setMemoryWalletOwnerForTest,
} from "../../data/memory-repository";

describe("trainer wallet session token", () => {
  it("binds the signed session to one trainer and canonical wallet", () => {
    const token = createTrainerSessionToken("trainer-a", "0xABCDEF", 1_000);
    expect(readTrainerSessionToken(token, 1_001)).toMatchObject({
      trainerId: "trainer-a",
      wallet: "0xabcdef",
    });
  });

  it("rejects tampering and expired tokens", () => {
    const token = createTrainerSessionToken("trainer-a", "0xabc", 1_000);
    expect(() => readTrainerSessionToken(`${token}x`, 1_001)).toThrow(TrainerSessionError);
    expect(() => readTrainerSessionToken(token, 1_000 + 12 * 60 * 60 * 1000)).toThrow(/expired/i);
  });

  it("does not let trainer A use trainer B's verified wallet link", async () => {
    resetMemoryRepository();
    const walletA = "0x00000000000000000000000000000000000000a1";
    const walletB = "0x00000000000000000000000000000000000000b2";
    setMemoryWalletOwnerForTest(walletA, "trainer-a");
    setMemoryWalletOwnerForTest(walletB, "trainer-b");
    const aToken = createTrainerSessionToken("trainer-a", walletA);
    expect(await resolveTrainerSession(memoryRepository, aToken)).toBe("trainer-a");
    const forged = createTrainerSessionToken("trainer-a", walletB);
    await expect(resolveTrainerSession(memoryRepository, forged)).rejects.toThrow(/no longer matches/i);
  });
});
