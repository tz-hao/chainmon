/**
 * ChainMon — Prisma seed (Phase 2)
 *
 * Idempotent: safe to run repeatedly (upsert by unique keys).
 * Writes: 16 skills, 20 species, species-skill links.
 *
 * Run with: npm run db:seed  (requires a reachable PostgreSQL + DATABASE_URL)
 */

import { PrismaClient } from "@prisma/client";
import { SKILLS, getSkillById } from "@chainmon/monster-data";
import { MONSTER_SPECIES } from "@chainmon/monster-data";

const prisma = new PrismaClient();

const ELEMENT_TO_PRISMA = {
  fire: "FIRE",
  water: "WATER",
  nature: "NATURE",
  electric: "ELECTRIC",
} as const;

const RARITY_TO_PRISMA = {
  common: "COMMON",
  rare: "RARE",
  epic: "EPIC",
  legendary: "LEGENDARY",
} as const;

/** Capture capsules — idempotently upserted by slug.
 *  ChainMon original designs (not Poké Ball copies); shop prices follow
 *  the Pixel World economy (Basic 25 / Great 80 / Ultra 240). */
const ITEMS = [
  {
    slug: "basic-ball",
    name: "Basic Capsule",
    type: "ball",
    description: "A standard ChainMon capture capsule with a hexagon core (1.0x).",
    value: 25,
  },
  {
    slug: "great-ball",
    name: "Great Capsule",
    type: "ball",
    description: "A superior blue-purple capsule with a 1.5x capture modifier.",
    value: 80,
  },
  {
    slug: "ultra-ball",
    name: "Ultra Capsule",
    type: "ball",
    description: "A black-gold high-performance capsule with a 2.0x capture modifier.",
    value: 240,
  },
  {
    slug: "fire-stone",
    name: "Fire Stone",
    type: "stone",
    description: "A blazing stone used to evolve certain Fire monsters.",
    value: 800,
  },
] as const;

async function seedItems() {
  for (const item of ITEMS) {
    await prisma.item.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        type: item.type,
        description: item.description,
        value: item.value,
      },
      create: {
        slug: item.slug,
        name: item.name,
        type: item.type,
        description: item.description,
        value: item.value,
      },
    });
  }
}

async function seedSkills(): Promise<Map<string, number>> {
  const skillIdByName = new Map<string, number>();

  for (const skill of SKILLS) {
    const element = ELEMENT_TO_PRISMA[skill.element];
    await prisma.skill.upsert({
      where: { name: skill.name },
      update: {
        element,
        power: skill.power,
        accuracy: skill.accuracy,
        description: skill.description,
      },
      create: {
        name: skill.name,
        element,
        power: skill.power,
        accuracy: skill.accuracy,
        description: skill.description,
      },
    });
  }

  const rows = await prisma.skill.findMany();
  for (const row of rows) {
    skillIdByName.set(row.name, row.id);
  }
  return skillIdByName;
}

async function seedSpecies() {
  for (const species of MONSTER_SPECIES) {
    const element = ELEMENT_TO_PRISMA[species.element];
    const rarity = RARITY_TO_PRISMA[species.rarity];
    await prisma.monsterSpecies.upsert({
      where: { slug: species.slug },
      update: {
        name: species.name,
        element,
        rarity,
        baseHp: species.baseHp,
        baseAttack: species.baseAttack,
        baseDefense: species.baseDefense,
        baseSpeed: species.baseSpeed,
        catchRate: species.catchRate,
        description: species.description,
        imageUrl: species.image,
        evolvesFromId: species.evolution?.evolvesFrom,
        evolveLevel: species.evolution?.level,
        evolveItem: species.evolution?.item,
      },
      create: {
        id: species.id,
        slug: species.slug,
        name: species.name,
        element,
        rarity,
        baseHp: species.baseHp,
        baseAttack: species.baseAttack,
        baseDefense: species.baseDefense,
        baseSpeed: species.baseSpeed,
        catchRate: species.catchRate,
        description: species.description,
        imageUrl: species.image,
        evolvesFromId: species.evolution?.evolvesFrom,
        evolveLevel: species.evolution?.level,
        evolveItem: species.evolution?.item,
      },
    });
  }
}

async function seedSpeciesSkills(skillIdByName: Map<string, number>) {
  for (const species of MONSTER_SPECIES) {
    for (const entry of species.learnableSkills) {
      const skill = getSkillById(entry.skillId);
      if (!skill) {
        throw new Error(
          `seed: species ${species.slug} references unknown skill ${entry.skillId}`,
        );
      }
      const skillId = skillIdByName.get(skill.name);
      if (skillId === undefined) {
        throw new Error(`seed: skill row missing for ${skill.name}`);
      }
      await prisma.monsterSpeciesSkill.upsert({
        where: { speciesId_skillId: { speciesId: species.id, skillId } },
        update: { learnLevel: entry.unlockLevel },
        create: {
          speciesId: species.id,
          skillId,
          learnLevel: entry.unlockLevel,
        },
      });
    }
  }
}

async function main() {
  await seedItems();
  const skillIdByName = await seedSkills();
  await seedSpecies();
  await seedSpeciesSkills(skillIdByName);

  const [skillCount, speciesCount, linkCount, itemCount] = await Promise.all([
    prisma.skill.count(),
    prisma.monsterSpecies.count(),
    prisma.monsterSpeciesSkill.count(),
    prisma.item.count(),
  ]);

  console.log(
    `Seed complete: ${skillCount} skills, ${speciesCount} species, ${linkCount} species-skill links, ${itemCount} items.`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
