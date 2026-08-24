import type { Monster, MonsterDNA } from "@chainmon/shared";
import { getSpeciesBySlug } from "@chainmon/monster-data";
import { describe, expect, it } from "vitest";
import {
  checkEvolutionEligibility,
  evolveMonsterData,
} from "../evolution";
import { calculateMonsterStats } from "../stats";

const DNA: MonsterDNA = {
  hpGene: 63,
  attackGene: 77,
  defenseGene: 41,
  speedGene: 88,
  mutationGene: 12,
};

function makeMonster(speciesId: number, level: number): Monster {
  return {
    id: "mon-1",
    speciesId,
    name: "FireCub",
    element: "fire",
    rarity: "common",
    level,
    exp: 0,
    hp: 60,
    attack: 73,
    defense: 40,
    speed: 50,
    skills: [],
    owner: "trainer-1",
    generation: 1,
    battleCount: 3,
    wins: 2,
    dna: DNA,
  };
}

const fireCub = getSpeciesBySlug("firecub");
const fireWolf = getSpeciesBySlug("firewolf");
const infernoWolf = getSpeciesBySlug("infernowolf");
if (!fireCub || !fireWolf || !infernoWolf) {
  throw new Error("test fixture: fire evolution chain missing");
}

const FIRE_STONE = { slug: "fire-stone", quantity: 1 };

describe("checkEvolutionEligibility", () => {
  it("rejects FireCub below level 16", () => {
    const result = checkEvolutionEligibility(makeMonster(1, 15), fireCub, []);
    expect(result.eligible).toBe(false);
    expect(result.missingLevel).toBe(16);
    expect(result.targetSpeciesId).toBe(2);
  });

  it("accepts FireCub at level 16 (level-only evolution)", () => {
    const result = checkEvolutionEligibility(makeMonster(1, 16), fireCub, []);
    expect(result.eligible).toBe(true);
    expect(result.targetSpeciesId).toBe(2);
  });

  it("rejects FireWolf at 32 without a Fire Stone", () => {
    const wolf = makeMonster(2, 32);
    const result = checkEvolutionEligibility(wolf, fireWolf, []);
    expect(result.eligible).toBe(false);
    expect(result.missingItem).toEqual({ itemSlug: "fire-stone", quantity: 1 });
  });

  it("accepts FireWolf at 32 with a Fire Stone", () => {
    const wolf = makeMonster(2, 32);
    const result = checkEvolutionEligibility(wolf, fireWolf, [FIRE_STONE]);
    expect(result.eligible).toBe(true);
    expect(result.targetSpeciesId).toBe(3);
  });

  it("rejects species without an evolution route", () => {
    const magmaboar = getSpeciesBySlug("magmaboar");
    if (!magmaboar) throw new Error("fixture missing");
    expect(checkEvolutionEligibility(makeMonster(5, 50), magmaboar, []).eligible).toBe(false);
  });
});

describe("evolveMonsterData", () => {
  it("preserves DNA exactly (DNA before === DNA after)", () => {
    const evolved = evolveMonsterData(makeMonster(1, 16), fireWolf);
    expect(evolved.dna).toEqual(DNA);
  });

  it("preserves identity: id, owner, generation, level, exp, battleCount, wins", () => {
    const monster = makeMonster(1, 16);
    const evolved = evolveMonsterData(monster, fireWolf);
    expect(evolved.id).toBe(monster.id);
    expect(evolved.owner).toBe(monster.owner);
    expect(evolved.generation).toBe(monster.generation);
    expect(evolved.level).toBe(monster.level);
    expect(evolved.exp).toBe(monster.exp);
    expect(evolved.battleCount).toBe(monster.battleCount);
    expect(evolved.wins).toBe(monster.wins);
  });

  it("updates species, name, element, rarity and stats from the target", () => {
    const evolved = evolveMonsterData(makeMonster(1, 16), fireWolf);
    expect(evolved.speciesId).toBe(2);
    expect(evolved.name).toBe("FireWolf");
    expect(evolved.element).toBe("fire");
    expect(evolved.rarity).toBe("rare");

    const expectedStats = calculateMonsterStats(fireWolf, DNA, 16);
    expect(evolved.hp).toBe(expectedStats.hp);
    expect(evolved.attack).toBe(expectedStats.attack);
    expect(evolved.defense).toBe(expectedStats.defense);
    expect(evolved.speed).toBe(expectedStats.speed);
  });

  it("merges target skills (keeps owned, adds learnable at level, max 4)", () => {
    const monster = makeMonster(1, 16);
    monster.skills = [
      { id: "ember", name: "Ember", element: "fire", power: 35, accuracy: 100, description: "" },
      { id: "fire-fang", name: "Fire Fang", element: "fire", power: 60, accuracy: 95, description: "" },
    ];
    const evolved = evolveMonsterData(monster, fireWolf);
    // FireWolf learnable at Lv16: ember, fire-fang, flame-burst → adds flame-burst
    expect(evolved.skills.map((s) => s.id)).toEqual([
      "ember",
      "fire-fang",
      "flame-burst",
    ]);
    expect(evolved.skills.length).toBeLessThanOrEqual(4);
  });

  it("never exceeds 4 skills when the target adds more", () => {
    const monster = makeMonster(2, 40);
    monster.skills = [
      { id: "ember", name: "Ember", element: "fire", power: 35, accuracy: 100, description: "" },
      { id: "fire-fang", name: "Fire Fang", element: "fire", power: 60, accuracy: 95, description: "" },
      { id: "flame-burst", name: "Flame Burst", element: "fire", power: 75, accuracy: 90, description: "" },
      { id: "water-gun", name: "Water Gun", element: "water", power: 40, accuracy: 100, description: "" },
    ];
    const evolved = evolveMonsterData(monster, infernoWolf);
    expect(evolved.skills.length).toBe(4);
  });
});
