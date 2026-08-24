import { describe, expect, it } from "vitest";
import { hashGameMonsterId, hashMonsterDNA } from "../hash";

const DNA = {
  hpGene: 63,
  attackGene: 77,
  defenseGene: 41,
  speedGene: 88,
  mutationGene: 12,
};

/**
 * Cross-language verification: these constants were produced by the real
 * Solidity DNAHashProbe during Phase 6 (contracts/contracts/test). If the
 * viem helpers ever diverge from the canonical ABI encoding, these tests
 * fail immediately.
 */
describe("canonical hashing (viem ↔ Solidity)", () => {
  it("matches the DNA hash computed by the Solidity probe", () => {
    expect(hashMonsterDNA(DNA)).toBe(
      "0x31d798d3b1539316e9c0418bbaa35eb99f89cc2f42938240f0a53aefeeb2fd93",
    );
  });

  it("matches the game-monster-id hash computed by the Solidity probe", () => {
    expect(hashGameMonsterId("monster-abc")).toBe(
      "0x7d4c1518a5fc6e769c43b7643b2a9fc43d79d092c673d9c65ea4755541465431",
    );
  });

  it("is deterministic", () => {
    expect(hashMonsterDNA(DNA)).toBe(hashMonsterDNA(DNA));
    expect(hashGameMonsterId("monster-abc")).toBe(
      hashGameMonsterId("monster-abc"),
    );
  });

  it("differs for different ids", () => {
    expect(hashGameMonsterId("monster-abc")).not.toBe(
      hashGameMonsterId("monster-abd"),
    );
  });
});
