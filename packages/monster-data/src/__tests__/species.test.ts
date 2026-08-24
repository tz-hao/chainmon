import { ELEMENTS, type Rarity } from "@chainmon/shared";
import { describe, expect, it } from "vitest";
import { SKILLS, getSkillById } from "../skills";
import {
  getEvolutionStage,
  getSpeciesById,
  getSpeciesBySlug,
  getStarters,
  MONSTER_SPECIES,
} from "../species";

const RARITY_BUDGETS: Record<Rarity, [number, number]> = {
  common: [180, 230],
  rare: [220, 270],
  epic: [260, 310],
  legendary: [300, 340],
};

describe("species catalogue", () => {
  it("has exactly 28 species (20 original + 8 Web3)", () => {
    expect(MONSTER_SPECIES).toHaveLength(28);
    // canonical ids 1-20 unchanged
    expect(MONSTER_SPECIES.filter((s) => s.id <= 20)).toHaveLength(20);
    expect(MONSTER_SPECIES.filter((s) => s.id > 20)).toHaveLength(8);
  });

  it("has exactly 7 species per element (5 original + 2 Web3)", () => {
    for (const element of ELEMENTS) {
      expect(MONSTER_SPECIES.filter((s) => s.element === element)).toHaveLength(
        7,
      );
    }
  });

  it("follows the rarity spread Common 9 / Rare 9 / Epic 7 / Legendary 3", () => {
    const count = (rarity: Rarity) =>
      MONSTER_SPECIES.filter((s) => s.rarity === rarity).length;
    expect(count("common")).toBe(9);
    expect(count("rare")).toBe(9);
    expect(count("epic")).toBe(7);
    expect(count("legendary")).toBe(3);
  });

  it("keeps base stat totals within rarity budgets", () => {
    for (const species of MONSTER_SPECIES) {
      const total =
        species.baseHp +
        species.baseAttack +
        species.baseDefense +
        species.baseSpeed;
      const [min, max] = RARITY_BUDGETS[species.rarity];
      expect(total, `${species.name} total ${total} >= ${min}`).toBeGreaterThanOrEqual(min);
      expect(total, `${species.name} total ${total} <= ${max}`).toBeLessThanOrEqual(max);
    }
  });

  it("has unique ids, slugs and names", () => {
    expect(new Set(MONSTER_SPECIES.map((s) => s.id)).size).toBe(28);
    expect(new Set(MONSTER_SPECIES.map((s) => s.slug)).size).toBe(28);
    expect(new Set(MONSTER_SPECIES.map((s) => s.name)).size).toBe(28);
  });

  it("has valid catch rates (0 < rate <= 1)", () => {
    for (const species of MONSTER_SPECIES) {
      expect(species.catchRate).toBeGreaterThan(0);
      expect(species.catchRate).toBeLessThanOrEqual(1);
    }
  });

  it("assigns 2-4 learnable skills with valid references", () => {
    for (const species of MONSTER_SPECIES) {
      expect(species.learnableSkills.length).toBeGreaterThanOrEqual(2);
      expect(species.learnableSkills.length).toBeLessThanOrEqual(4);
      for (const entry of species.learnableSkills) {
        expect(entry.unlockLevel).toBeGreaterThanOrEqual(1);
        expect(
          getSkillById(entry.skillId),
          `${species.name} references unknown skill ${entry.skillId}`,
        ).toBeDefined();
      }
    }
  });

  it("keeps every learnable skill within the species element", () => {
    for (const species of MONSTER_SPECIES) {
      for (const entry of species.learnableSkills) {
        expect(getSkillById(entry.skillId)?.element).toBe(species.element);
      }
    }
  });

  it("references valid evolution targets", () => {
    for (const species of MONSTER_SPECIES) {
      const evolution = species.evolution;
      if (!evolution) continue;
      if (evolution.evolvesFrom !== undefined) {
        expect(getSpeciesById(evolution.evolvesFrom)).toBeDefined();
      }
      if (evolution.evolvesTo !== undefined) {
        expect(getSpeciesById(evolution.evolvesTo)).toBeDefined();
      }
    }
  });

  it("has image paths under /monsters/", () => {
    for (const species of MONSTER_SPECIES) {
      expect(species.image.startsWith("/monsters/")).toBe(true);
      expect(species.image.endsWith(".svg")).toBe(true);
    }
  });

  it("provides exactly 3 Common starters (Fire / Water / Nature, no Electric)", () => {
    const starters = getStarters();
    expect(starters).toHaveLength(3);
    expect(new Set(starters.map((s) => s.element))).toEqual(
      new Set(["fire", "water", "nature"]),
    );
    for (const starter of starters) {
      expect(starter.rarity).toBe("common");
    }
  });

  it("defines the Fire evolution chain FireCub → FireWolf → InfernoWolf", () => {
    const cub = getSpeciesBySlug("firecub");
    const wolf = getSpeciesBySlug("firewolf");
    const inferno = getSpeciesBySlug("infernowolf");
    expect(cub).toBeDefined();
    expect(wolf).toBeDefined();
    expect(inferno).toBeDefined();
    if (!cub || !wolf || !inferno) return;
    expect(cub.evolution?.evolvesTo).toBe(wolf.id);
    expect(cub.evolution?.level).toBe(16);
    expect(wolf.evolution?.evolvesFrom).toBe(cub.id);
    expect(wolf.evolution?.evolvesTo).toBe(inferno.id);
    expect(wolf.evolution?.level).toBe(32);
    expect(wolf.evolution?.item).toBe("Fire Stone");
    expect(inferno.evolution?.evolvesFrom).toBe(wolf.id);
  });

  it("has no out-of-family evolutions outside Fire", () => {
    for (const species of MONSTER_SPECIES) {
      if (species.element !== "fire") {
        expect(species.evolution).toBeUndefined();
      }
    }
  });

  it("computes on-chain evolution stages (FireCub 0 → FireWolf 1 → InfernoWolf 2)", () => {
    expect(getEvolutionStage(getSpeciesBySlug("firecub")!)).toBe(0);
    expect(getEvolutionStage(getSpeciesBySlug("firewolf")!)).toBe(1);
    expect(getEvolutionStage(getSpeciesBySlug("infernowolf")!)).toBe(2);
    expect(getEvolutionStage(getSpeciesBySlug("magmaboar")!)).toBe(0);
    expect(getEvolutionStage(getSpeciesBySlug("abyssshark")!)).toBe(0);
  });
});

describe("skills catalogue", () => {
  it("has at least 16 skills and 12 per element (4 base + 8 Web3)", () => {
    expect(SKILLS.length).toBeGreaterThanOrEqual(16);
    for (const element of ELEMENTS) {
      expect(SKILLS.filter((s) => s.element === element)).toHaveLength(12);
    }
  });

  it("has unique ids and sane power/accuracy values", () => {
    expect(new Set(SKILLS.map((s) => s.id)).size).toBe(SKILLS.length);
    for (const skill of SKILLS) {
      expect(skill.power).toBeGreaterThan(0);
      expect(skill.accuracy).toBeGreaterThan(0);
      expect(skill.accuracy).toBeLessThanOrEqual(100);
      expect(skill.description.length).toBeGreaterThan(0);
    }
  });

  it("attaches knowledge to every Web3 skill (8 concepts)", () => {
    const web3Skills = SKILLS.filter((s) => s.id !== undefined && SKILLS.indexOf(s) >= 16);
    expect(web3Skills.length).toBe(32);
    for (const skill of web3Skills) {
      expect(skill.knowledgeTitle, skill.id).toBeTruthy();
      expect(skill.knowledgeSummary, skill.id).toBeTruthy();
      expect(skill.knowledgeSummary!.length).toBeGreaterThan(20);
    }
    const titles = new Set(web3Skills.map((s) => s.knowledgeTitle));
    // 8 concepts: Swap / Liquidity / Slippage / AMM / Oracle / ZK / Bridge /
    // Lending / Gas / MEV / Self Custody (each monster carries 2-4 unique
    // concepts; total unique titles ≥ 8)
    expect(titles.size).toBeGreaterThanOrEqual(8);
  });
});
