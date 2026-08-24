import type { MonsterDNA } from "@chainmon/shared";
import { describe, expect, it } from "vitest";
import {
  calculateMonsterStats,
  calculateStat,
  dnaBonus,
  isLegalDNA,
} from "../stats";

describe("dnaBonus", () => {
  it("is floor(gene / 10)", () => {
    expect(dnaBonus(0)).toBe(0);
    expect(dnaBonus(9)).toBe(0);
    expect(dnaBonus(10)).toBe(1);
    expect(dnaBonus(83)).toBe(8);
    expect(dnaBonus(100)).toBe(10);
  });

  it("clamps out-of-range genes", () => {
    expect(dnaBonus(150)).toBe(10);
    expect(dnaBonus(-5)).toBe(0);
  });
});

describe("calculateStat", () => {
  it("applies Base + DNA Bonus at level 1 (base 70, gene 83 → 78)", () => {
    expect(calculateStat(70, 83, 1)).toBe(78);
  });

  it("applies DNA-scaled level growth at higher levels (Phase 5 formula)", () => {
    // 70 + floor(83/10) + floor(4 × 2 × (0.75 + 83/200)) = 70 + 8 + 9 = 87
    expect(calculateStat(70, 83, 5)).toBe(87);
  });

  it("throws for invalid levels", () => {
    expect(() => calculateStat(10, 50, 0)).toThrow();
    expect(() => calculateStat(10, 50, 1.5)).toThrow();
  });
});

describe("calculateMonsterStats", () => {
  it("computes all four stats from species + DNA at level 1", () => {
    const species = { baseHp: 55, baseAttack: 65, baseDefense: 35, baseSpeed: 45 };
    const dna: MonsterDNA = {
      hpGene: 50,
      attackGene: 83,
      defenseGene: 20,
      speedGene: 100,
      mutationGene: 40,
    };
    const stats = calculateMonsterStats(species, dna, 1);
    expect(stats.hp).toBe(60); // 55 + 5
    expect(stats.attack).toBe(73); // 65 + 8 (FireCub base attack is 65)
    expect(stats.defense).toBe(37); // 35 + 2
    expect(stats.speed).toBe(55); // 45 + 10
  });

  it("grows with level (Level 10 stats > Level 1 stats)", () => {
    const species = { baseHp: 55, baseAttack: 65, baseDefense: 35, baseSpeed: 45 };
    const dna: MonsterDNA = {
      hpGene: 50,
      attackGene: 50,
      defenseGene: 50,
      speedGene: 50,
      mutationGene: 50,
    };
    const level1 = calculateMonsterStats(species, dna, 1);
    const level10 = calculateMonsterStats(species, dna, 10);
    expect(level10.hp).toBeGreaterThan(level1.hp);
    expect(level10.attack).toBeGreaterThan(level1.attack);
    expect(level10.defense).toBeGreaterThan(level1.defense);
    expect(level10.speed).toBeGreaterThan(level1.speed);
  });

  it("lets DNA influence growth (high gene > low gene at high level)", () => {
    const species = { baseHp: 55, baseAttack: 65, baseDefense: 35, baseSpeed: 45 };
    const weak: MonsterDNA = {
      hpGene: 0,
      attackGene: 0,
      defenseGene: 0,
      speedGene: 0,
      mutationGene: 0,
    };
    const strong: MonsterDNA = {
      hpGene: 100,
      attackGene: 100,
      defenseGene: 100,
      speedGene: 100,
      mutationGene: 100,
    };
    const weakLv30 = calculateMonsterStats(species, weak, 30);
    const strongLv30 = calculateMonsterStats(species, strong, 30);
    expect(strongLv30.hp).toBeGreaterThan(weakLv30.hp);
    expect(strongLv30.attack).toBeGreaterThan(weakLv30.attack);
    expect(strongLv30.speed).toBeGreaterThan(weakLv30.speed);
    // growth difference is meaningful but bounded
    expect(strongLv30.hp - weakLv30.hp).toBeLessThan(50);
  });

  it("is a pure function — identical inputs always give identical outputs", () => {
    const species = { baseHp: 55, baseAttack: 65, baseDefense: 35, baseSpeed: 45 };
    const dna: MonsterDNA = {
      hpGene: 63,
      attackGene: 77,
      defenseGene: 41,
      speedGene: 88,
      mutationGene: 12,
    };
    const a = calculateMonsterStats(species, dna, 24);
    const b = calculateMonsterStats(species, dna, 24);
    const c = calculateMonsterStats(species, dna, 24);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });
});

describe("isLegalDNA", () => {
  it("accepts legal DNA", () => {
    expect(
      isLegalDNA({
        hpGene: 0,
        attackGene: 50,
        defenseGene: 100,
        speedGene: 33,
        mutationGene: 77,
      }),
    ).toBe(true);
  });

  it("rejects out-of-range genes", () => {
    expect(
      isLegalDNA({
        hpGene: 101,
        attackGene: 0,
        defenseGene: 0,
        speedGene: 0,
        mutationGene: 0,
      }),
    ).toBe(false);
    expect(
      isLegalDNA({
        hpGene: -1,
        attackGene: 0,
        defenseGene: 0,
        speedGene: 0,
        mutationGene: 0,
      }),
    ).toBe(false);
  });

  it("rejects non-integer genes", () => {
    expect(
      isLegalDNA({
        hpGene: 1.5,
        attackGene: 0,
        defenseGene: 0,
        speedGene: 0,
        mutationGene: 0,
      }),
    ).toBe(false);
  });
});
