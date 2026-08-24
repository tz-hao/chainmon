import { describe, expect, it } from "vitest";
import { MAX_ONCHAIN_EVOLUTION_STAGE, ONCHAIN_RARITY } from "../onchain";

describe("ONCHAIN_RARITY", () => {
  it("maps all four rarities to 0-3 in canonical order", () => {
    expect(ONCHAIN_RARITY.common).toBe(0);
    expect(ONCHAIN_RARITY.rare).toBe(1);
    expect(ONCHAIN_RARITY.epic).toBe(2);
    expect(ONCHAIN_RARITY.legendary).toBe(3);
  });

  it("has unique values covering exactly 0-3", () => {
    const values = Object.values(ONCHAIN_RARITY).sort((a, b) => a - b);
    expect(values).toEqual([0, 1, 2, 3]);
  });

  it("limits the on-chain evolution stage to 2", () => {
    expect(MAX_ONCHAIN_EVOLUTION_STAGE).toBe(2);
  });
});
