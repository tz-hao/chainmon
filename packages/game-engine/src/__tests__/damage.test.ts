import { describe, expect, it } from "vitest";
import {
  calculateBaseDamage,
  calculateDamage,
  DEFEND_MULTIPLIER,
  isHit,
  MIN_DAMAGE,
} from "../damage";

const BASE = {
  power: 40,
  attackerAttack: 50,
  defenderDefense: 50,
  elementMultiplier: 1.0,
  randomFactor: 1.0,
};

describe("calculateBaseDamage", () => {
  it("computes (power × attack / max(defense,1)) × 0.5", () => {
    expect(calculateBaseDamage(40, 50, 50)).toBe(20);
    expect(calculateBaseDamage(40, 50, 25)).toBe(40);
    expect(calculateBaseDamage(40, 50, 1)).toBe(1000); // defense floored at 1
  });

  it("throws on illegal inputs", () => {
    expect(() => calculateBaseDamage(-1, 50, 50)).toThrow();
    expect(() => calculateBaseDamage(40, -1, 50)).toThrow();
    expect(() => calculateBaseDamage(40, 50, -1)).toThrow();
  });
});

describe("calculateDamage", () => {
  it("is deterministic with randomFactor 1.0", () => {
    expect(calculateDamage(BASE)).toBe(20);
  });

  it("scales with defense (higher defense → less damage)", () => {
    const lowDef = calculateDamage({ ...BASE, defenderDefense: 40 });
    const highDef = calculateDamage({ ...BASE, defenderDefense: 80 });
    expect(highDef).toBeLessThan(lowDef);
  });

  it("scales with attack (higher attack → more damage)", () => {
    const lowAtk = calculateDamage({ ...BASE, attackerAttack: 40 });
    const highAtk = calculateDamage({ ...BASE, attackerAttack: 80 });
    expect(highAtk).toBeGreaterThan(lowAtk);
  });

  it("scales with power (higher power → more damage)", () => {
    const lowPower = calculateDamage({ ...BASE, power: 35 });
    const highPower = calculateDamage({ ...BASE, power: 95 });
    expect(highPower).toBeGreaterThan(lowPower);
  });

  it("orders super-effective > neutral > resisted", () => {
    const resisted = calculateDamage({ ...BASE, elementMultiplier: 0.75 });
    const neutral = calculateDamage({ ...BASE, elementMultiplier: 1.0 });
    const superEffective = calculateDamage({ ...BASE, elementMultiplier: 1.5 });
    expect(superEffective).toBeGreaterThan(neutral);
    expect(neutral).toBeGreaterThan(resisted);
  });

  it("orders random factors 0.9 < 1.0 < 1.1", () => {
    const low = calculateDamage({ ...BASE, randomFactor: 0.9 });
    const normal = calculateDamage({ ...BASE, randomFactor: 1.0 });
    const high = calculateDamage({ ...BASE, randomFactor: 1.1 });
    expect(low).toBeLessThan(normal);
    expect(normal).toBeLessThan(high);
  });

  it("halves damage when defending", () => {
    const normal = calculateDamage(BASE);
    const defending = calculateDamage({ ...BASE, defendMultiplier: DEFEND_MULTIPLIER });
    expect(defending).toBe(Math.floor(normal * 0.5));
  });

  it("never deals less than 1 damage", () => {
    expect(
      calculateDamage({ ...BASE, power: 1, attackerAttack: 1, defenderDefense: 200 }),
    ).toBe(MIN_DAMAGE);
  });
});

describe("isHit", () => {
  it("hits when roll < accuracy/100 (90% accuracy, roll 0.20)", () => {
    expect(isHit(90, 0.2)).toBe(true);
  });

  it("misses when roll >= accuracy/100 (90% accuracy, roll 0.95)", () => {
    expect(isHit(90, 0.95)).toBe(false);
  });

  it("a miss deals no damage (caller returns 0)", () => {
    expect(isHit(90, 0.95)).toBe(false);
  });

  it("throws on out-of-range accuracy", () => {
    expect(() => isHit(101, 0.5)).toThrow();
    expect(() => isHit(-1, 0.5)).toThrow();
  });
});
