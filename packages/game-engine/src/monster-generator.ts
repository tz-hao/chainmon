/**
 * @chainmon/game-engine — monster-generator.ts
 * Creates individual monsters from a species definition.
 *
 * Every monster gets a unique DNA (rarity-scaled) which drives its
 * final stats via calculateStats: Final = Base + DNA Bonus (+ Level Bonus).
 * Same species, different DNA → different stats.
 */

import type { Monster, MonsterDNA, Rarity, Skill } from "@chainmon/shared";
import {
  getSkillById,
  type MonsterSpeciesData,
} from "@chainmon/monster-data";
import { randomId, randomInt } from "./random";
import { calculateMonsterStats, DNA_MAX } from "./stats";

/**
 * Rarity raises the lower bound of every gene (0-100 scale),
 * so higher rarity monsters get better DNA rewards on average
 * without breaking balance.
 */
const DNA_GENE_FLOOR: Record<Rarity, number> = {
  common: 0,
  rare: 20,
  epic: 35,
  legendary: 50,
};

/**
 * Generate a legal DNA (all genes integer, 0-100).
 */
export function generateDNA(rarity: Rarity = "common"): MonsterDNA {
  const floor = DNA_GENE_FLOOR[rarity];
  return {
    hpGene: randomInt(floor, DNA_MAX),
    attackGene: randomInt(floor, DNA_MAX),
    defenseGene: randomInt(floor, DNA_MAX),
    speedGene: randomInt(floor, DNA_MAX),
    mutationGene: randomInt(floor, DNA_MAX),
  };
}

export interface GenerateMonsterOptions {
  id?: string;
  owner?: string;
  level?: number;
  generation?: number;
  dna?: MonsterDNA;
}

/**
 * Generate a complete individual monster from a species.
 * Stats are derived from base stats + DNA (level bonus at level > 1).
 */
export function generateMonster(
  species: MonsterSpeciesData,
  options: GenerateMonsterOptions = {},
): Monster {
  const dna = options.dna ?? generateDNA(species.rarity);
  const level = options.level ?? 1;

  const stats = calculateMonsterStats(species, dna, level);

  const skills: Skill[] = species.learnableSkills
    .filter((entry) => entry.unlockLevel <= level)
    .map((entry) => getSkillById(entry.skillId))
    .filter((skill): skill is Skill => skill !== undefined);

  return {
    id: options.id ?? randomId(),
    speciesId: species.id,
    name: species.name,
    element: species.element,
    rarity: species.rarity,
    level,
    exp: 0,
    hp: stats.hp,
    attack: stats.attack,
    defense: stats.defense,
    speed: stats.speed,
    skills,
    owner: options.owner ?? null,
    generation: options.generation ?? 1,
    battleCount: 0,
    wins: 0,
    dna,
  };
}
