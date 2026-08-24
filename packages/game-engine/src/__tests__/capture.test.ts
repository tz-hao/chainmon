import { describe, expect, it } from "vitest";
import {
  attemptCapture,
  calculateCaptureChance,
  CAPTURE_BALLS,
  getCaptureBall,
  hpModifier,
  MAX_CAPTURE_CHANCE,
  MIN_CAPTURE_CHANCE,
} from "../capture";
import type { RandomSource } from "../random";

const source = (value: number): RandomSource => ({ next: () => value });

describe("hpModifier (Pixel World thresholds)", () => {
  it("is 1.00 above 70% HP", () => {
    expect(hpModifier(100, 100)).toBe(1.0);
    expect(hpModifier(80, 100)).toBe(1.0);
    expect(hpModifier(71, 100)).toBe(1.0);
  });

  it("is 1.15 at 70% HP and below (until 40%)", () => {
    expect(hpModifier(70, 100)).toBe(1.15);
    expect(hpModifier(50, 100)).toBe(1.15);
    expect(hpModifier(41, 100)).toBe(1.15);
  });

  it("is 1.40 at 40% HP and below (until 15%)", () => {
    expect(hpModifier(40, 100)).toBe(1.4);
    expect(hpModifier(20, 100)).toBe(1.4);
    expect(hpModifier(16, 100)).toBe(1.4);
  });

  it("is 1.80 at 15% HP and below", () => {
    expect(hpModifier(15, 100)).toBe(1.8);
    expect(hpModifier(1, 100)).toBe(1.8);
    expect(hpModifier(0, 100)).toBe(1.8);
  });
});

describe("capture balls (capsules)", () => {
  it("modifiers are Basic 1.0 / Great 1.5 / Ultra 2.0", () => {
    expect(getCaptureBall("basic-ball")?.modifier).toBe(1.0);
    expect(getCaptureBall("great-ball")?.modifier).toBe(1.5);
    expect(getCaptureBall("ultra-ball")?.modifier).toBe(2.0);
    expect(CAPTURE_BALLS).toHaveLength(3);
  });

  it("no ball can push any species past 95%", () => {
    for (const ball of CAPTURE_BALLS) {
      const chance = calculateCaptureChance({
        catchRate: 0.6,
        currentHp: 0,
        maxHp: 100,
        ballModifier: ball.modifier,
      });
      expect(chance).toBeLessThanOrEqual(MAX_CAPTURE_CHANCE);
    }
  });
});

describe("calculateCaptureChance", () => {
  it("equals catchRate at full HP with a Basic Capsule", () => {
    expect(
      calculateCaptureChance({ catchRate: 0.5, currentHp: 100, maxHp: 100, ballModifier: 1.0 }),
    ).toBeCloseTo(0.5, 5);
  });

  it("clamps to the 95% ceiling", () => {
    const chance = calculateCaptureChance({
      catchRate: 0.6,
      currentHp: 10,
      maxHp: 100,
      ballModifier: 2.0,
    });
    expect(chance).toBe(MAX_CAPTURE_CHANCE);
  });

  it("clamps to the 15% floor (never impossible)", () => {
    const chance = calculateCaptureChance({
      catchRate: 0.08,
      currentHp: 100,
      maxHp: 100,
      ballModifier: 1.0,
    });
    expect(chance).toBe(MIN_CAPTURE_CHANCE);
  });

  it("never leaves [0.15, 0.95]", () => {
    for (const catchRate of [0.08, 0.16, 0.3, 0.5, 0.6]) {
      for (const ballModifier of [1.0, 1.5, 2.0]) {
        for (const hp of [100, 60, 30, 5]) {
          const chance = calculateCaptureChance({ catchRate, currentHp: hp, maxHp: 100, ballModifier });
          expect(chance).toBeGreaterThanOrEqual(MIN_CAPTURE_CHANCE);
          expect(chance).toBeLessThanOrEqual(MAX_CAPTURE_CHANCE);
        }
      }
    }
  });

  it("rises as HP drops (threshold steps)", () => {
    const full = calculateCaptureChance({ catchRate: 0.5, currentHp: 100, maxHp: 100, ballModifier: 1.0 });
    const mid = calculateCaptureChance({ catchRate: 0.5, currentHp: 50, maxHp: 100, ballModifier: 1.0 });
    const low = calculateCaptureChance({ catchRate: 0.5, currentHp: 10, maxHp: 100, ballModifier: 1.0 });
    expect(mid).toBeGreaterThan(full);
    expect(low).toBeGreaterThan(mid);
  });

  it("throws on illegal inputs", () => {
    expect(() =>
      calculateCaptureChance({ catchRate: 1.5, currentHp: 100, maxHp: 100, ballModifier: 1.0 }),
    ).toThrow(/catchRate/);
    expect(() =>
      calculateCaptureChance({ catchRate: -0.1, currentHp: 100, maxHp: 100, ballModifier: 1.0 }),
    ).toThrow(/catchRate/);
    expect(() =>
      calculateCaptureChance({ catchRate: 0.4, currentHp: -1, maxHp: 100, ballModifier: 1.0 }),
    ).toThrow(/currentHp/);
    expect(() =>
      calculateCaptureChance({ catchRate: 0.4, currentHp: 100, maxHp: 0, ballModifier: 1.0 }),
    ).toThrow(/maxHp/);
    expect(() =>
      calculateCaptureChance({ catchRate: 0.4, currentHp: 101, maxHp: 100, ballModifier: 1.0 }),
    ).toThrow(/currentHp/);
    expect(() =>
      calculateCaptureChance({ catchRate: 0.4, currentHp: 100, maxHp: 100, ballModifier: 0 }),
    ).toThrow(/ballModifier/);
  });
});

describe("attemptCapture", () => {
  it("succeeds when roll < chance", () => {
    const attempt = attemptCapture({
      catchRate: 0.5,
      currentHp: 100,
      maxHp: 100,
      ballModifier: 1.0,
      randomSource: source(0.2),
    });
    expect(attempt.chance).toBeCloseTo(0.5, 5);
    expect(attempt.success).toBe(true);
  });

  it("fails when roll >= chance", () => {
    const attempt = attemptCapture({
      catchRate: 0.5,
      currentHp: 100,
      maxHp: 100,
      ballModifier: 1.0,
      randomSource: source(0.8),
    });
    expect(attempt.success).toBe(false);
  });

  it("returns the ball modifier used", () => {
    const attempt = attemptCapture({
      catchRate: 0.5,
      currentHp: 100,
      maxHp: 100,
      ballModifier: 1.5,
      randomSource: source(0.1),
    });
    expect(attempt.ballModifier).toBe(1.5);
  });
});
