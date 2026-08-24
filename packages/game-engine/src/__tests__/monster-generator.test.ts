import type { MonsterDNA } from "@chainmon/shared";
import { getSpeciesById, MONSTER_SPECIES } from "@chainmon/monster-data";
import { describe, expect, it } from "vitest";
import { generateDNA, generateMonster } from "../monster-generator";
import { isLegalDNA } from "../stats";

const fireCub = getSpeciesById(1);
if (!fireCub) throw new Error("test fixture: FireCub species missing");

describe("generateDNA", () => {
  it("returns legal DNA (integer genes in 0-100)", () => {
    for (let i = 0; i < 200; i++) {
      expect(isLegalDNA(generateDNA())).toBe(true);
    }
  });

  it("produces varied DNA across generations", () => {
    let differ = false;
    for (let i = 0; i < 50 && !differ; i++) {
      const a = generateDNA("common");
      const b = generateDNA("common");
      differ = JSON.stringify(a) !== JSON.stringify(b);
    }
    expect(differ).toBe(true);
  });

  it("raises gene floors by rarity", () => {
    for (let i = 0; i < 100; i++) {
      const rare = generateDNA("rare");
      expect(rare.hpGene).toBeGreaterThanOrEqual(20);
      const epic = generateDNA("epic");
      expect(epic.hpGene).toBeGreaterThanOrEqual(35);
      const legendary = generateDNA("legendary");
      expect(legendary.hpGene).toBeGreaterThanOrEqual(50);
    }
  });
});

describe("generateMonster", () => {
  it("generates a complete level-1 monster", () => {
    const monster = generateMonster(fireCub, { owner: "trainer-1" });
    expect(monster.level).toBe(1);
    expect(monster.exp).toBe(0);
    expect(monster.generation).toBe(1);
    expect(monster.battleCount).toBe(0);
    expect(monster.wins).toBe(0);
    expect(monster.owner).toBe("trainer-1");
    expect(monster.speciesId).toBe(fireCub.id);
    expect(monster.name).toBe("FireCub");
    expect(monster.element).toBe("fire");
    expect(monster.rarity).toBe("common");
    expect(monster.id.length).toBeGreaterThan(0);
  });

  it("computes stats from base + DNA", () => {
    const dna: MonsterDNA = {
      hpGene: 50,
      attackGene: 83,
      defenseGene: 20,
      speedGene: 100,
      mutationGene: 40,
    };
    const monster = generateMonster(fireCub, { dna });
    expect(monster.hp).toBe(60); // 55 + 5
    expect(monster.attack).toBe(73); // 65 + 8 (FireCub base attack is 65)
    expect(monster.defense).toBe(37); // 35 + 2
    expect(monster.speed).toBe(55); // 45 + 10
    expect(monster.dna).toEqual(dna);
  });

  it("yields different stats for the same species with different DNA", () => {
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
    const a = generateMonster(fireCub, { dna: weak });
    const b = generateMonster(fireCub, { dna: strong });
    expect(a.hp).not.toBe(b.hp);
    expect(a.attack).not.toBe(b.attack);
    expect(a.speed).not.toBe(b.speed);
  });

  it("assigns only skills with unlockLevel <= level (Phase 5)", () => {
    const monster = generateMonster(fireCub);
    expect(monster.skills.length).toBeGreaterThanOrEqual(2);
    expect(monster.skills.every((s) => s.element === "fire")).toBe(true);
    const learnableAtLevel = new Set(
      fireCub.learnableSkills
        .filter((e) => e.unlockLevel <= 1)
        .map((e) => e.skillId),
    );
    expect(
      monster.skills.map((s) => s.id).every((id) => learnableAtLevel.has(id)),
    ).toBe(true);
  });

  it("produces legal DNA and positive stats for every species", () => {
    for (const species of MONSTER_SPECIES) {
      const monster = generateMonster(species);
      expect(isLegalDNA(monster.dna)).toBe(true);
      expect(monster.hp).toBeGreaterThan(0);
      expect(monster.attack).toBeGreaterThan(0);
      expect(monster.defense).toBeGreaterThan(0);
      expect(monster.speed).toBeGreaterThan(0);
      expect(monster.skills.length).toBeGreaterThanOrEqual(2);
    }
  });
});
