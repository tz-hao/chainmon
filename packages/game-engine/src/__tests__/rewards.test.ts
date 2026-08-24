import type { BattleCreatureState } from "../battle";
import { describe, expect, it } from "vitest";
import {
  calculateBattleExp,
  calculateGoldReward,
  rollEvolutionItemReward,
  rollItemReward,
  sumCreaturePower,
} from "../rewards";
import type { RandomSource } from "../random";

const source = (value: number): RandomSource => ({ next: () => value });

function creature(overrides: Partial<BattleCreatureState> = {}): BattleCreatureState {
  return {
    battleMonsterId: "x",
    speciesId: 1,
    speciesName: "M",
    element: "fire",
    rarity: "common",
    level: 1,
    maxHp: 80,
    currentHp: 80,
    attack: 65,
    defense: 40,
    speed: 45,
    skills: [],
    fainted: false,
    ...overrides,
  };
}

describe("sumCreaturePower", () => {
  it("sums maxHp + attack + defense + speed over the team", () => {
    const team = [creature(), creature({ maxHp: 90, attack: 50, defense: 60, speed: 30 })];
    // 230 + 230
    expect(sumCreaturePower(team)).toBe(460);
  });
});

describe("calculateBattleExp", () => {
  it("victory grants floor(power / 12) per monster", () => {
    // 3 creatures × 230 = 690 → 57
    expect(calculateBattleExp(690, true)).toBe(57);
  });

  it("defeat grants 25% of victory EXP (participation), at least 1", () => {
    expect(calculateBattleExp(690, false)).toBe(Math.max(1, Math.floor(57 * 0.25)));
    expect(calculateBattleExp(10, false)).toBe(1);
  });

  it("victory EXP is clearly higher than defeat EXP", () => {
    const power = 750;
    expect(calculateBattleExp(power, true)).toBeGreaterThan(calculateBattleExp(power, false));
  });
});

describe("calculateGoldReward", () => {
  it("victory grants floor(power / 8)", () => {
    expect(calculateGoldReward(750, true)).toBe(93);
  });

  it("defeat grants 25% of victory gold, at least 1", () => {
    expect(calculateGoldReward(750, false)).toBe(23);
  });

  it("victory gold exceeds defeat gold", () => {
    expect(calculateGoldReward(750, true)).toBeGreaterThan(calculateGoldReward(750, false));
  });
});

describe("rollItemReward (Pixel World ball drops)", () => {
  it("is deterministic with an injected RandomSource", () => {
    const a = rollItemReward("player", source(0.99));
    const b = rollItemReward("player", source(0.99));
    expect(a).toEqual(b);
  });

  it("drops nothing for rolls below 0.58 on victory", () => {
    expect(rollItemReward("player", source(0.5))).toBeNull();
    expect(rollItemReward("player", source(0.57))).toBeNull();
  });

  it("drops a Basic Capsule for victory rolls in [0.58, 0.88)", () => {
    expect(rollItemReward("player", source(0.7))).toEqual({
      itemSlug: "basic-ball",
      quantity: 1,
    });
  });

  it("drops a Great Capsule for victory rolls in [0.88, 0.98)", () => {
    expect(rollItemReward("player", source(0.93))).toEqual({
      itemSlug: "great-ball",
      quantity: 1,
    });
  });

  it("drops an Ultra Capsule for victory rolls >= 0.98", () => {
    expect(rollItemReward("player", source(0.995))).toEqual({
      itemSlug: "ultra-ball",
      quantity: 1,
    });
  });

  it("rollEvolutionItemReward keeps the legacy Fire Stone chance", () => {
    expect(rollEvolutionItemReward(true, source(0.005))).toEqual({
      itemSlug: "fire-stone",
      quantity: 1,
    });
    expect(rollEvolutionItemReward(true, source(0.5))).toBeNull();
    expect(rollEvolutionItemReward(false, source(0.005))).toBeNull();
  });

  it("never drops evolution items on defeat", () => {
    for (const value of [0.5, 0.9, 0.97, 0.995]) {
      const drop = rollItemReward("opponent", source(value));
      expect(drop?.itemSlug).not.toBe("fire-stone");
    }
  });

  it("drops a Basic Capsule on defeat only for rolls >= 0.92", () => {
    expect(rollItemReward("opponent", source(0.9))).toBeNull();
    expect(rollItemReward("opponent", source(0.99))).toEqual({
      itemSlug: "basic-ball",
      quantity: 1,
    });
  });
});
