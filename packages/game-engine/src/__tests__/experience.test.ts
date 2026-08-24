import { describe, expect, it } from "vitest";
import {
  applyExperience,
  getRequiredExp,
  MAX_LEVEL,
} from "../experience";

describe("getRequiredExp", () => {
  it("follows level × level × 100", () => {
    expect(getRequiredExp(1)).toBe(100);
    expect(getRequiredExp(2)).toBe(400);
    expect(getRequiredExp(3)).toBe(900);
    expect(getRequiredExp(10)).toBe(10000);
  });

  it("rejects illegal levels", () => {
    expect(() => getRequiredExp(0)).toThrow();
    expect(() => getRequiredExp(-3)).toThrow();
    expect(() => getRequiredExp(1.5)).toThrow();
  });
});

describe("applyExperience", () => {
  it("levels up once and keeps the remainder (Lv1 EXP 50 + 60 → Lv2 EXP 10)", () => {
    const result = applyExperience(1, 50, 60);
    expect(result.oldLevel).toBe(1);
    expect(result.newLevel).toBe(2);
    expect(result.newExp).toBe(10);
    expect(result.levelsGained).toBe(1);
  });

  it("levels up multiple times (Lv1 EXP 0 + 700 → Lv3 EXP 200)", () => {
    const result = applyExperience(1, 0, 700);
    expect(result.newLevel).toBe(3);
    expect(result.newExp).toBe(200);
    expect(result.levelsGained).toBe(2);
  });

  it("does not level up when EXP is insufficient (Lv2 EXP 100 + 50 → Lv2 EXP 150)", () => {
    const result = applyExperience(2, 100, 50);
    expect(result.newLevel).toBe(2);
    expect(result.newExp).toBe(150);
    expect(result.levelsGained).toBe(0);
  });

  it("respects the level cap (Lv50 never gains levels, EXP capped to 0)", () => {
    const result = applyExperience(MAX_LEVEL, 0, 100000);
    expect(result.newLevel).toBe(MAX_LEVEL);
    expect(result.newExp).toBe(0);
    expect(result.levelsGained).toBe(0);
  });

  it("caps EXP at 0 exactly when reaching the cap", () => {
    // Lv49 EXP 0 + 239900 → reaches Lv50 exactly (sum 100..2401 ×100 = huge)
    const result = applyExperience(49, 0, 250000);
    expect(result.newLevel).toBe(50);
    expect(result.newExp).toBe(0);
  });

  it("rejects negative EXP input", () => {
    expect(() => applyExperience(1, 0, -10)).toThrow();
    expect(() => applyExperience(1, -5, 10)).toThrow();
  });
});
