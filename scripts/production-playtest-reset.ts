/**
 * Guarded, one-time public-playtest reset.
 *
 * This script NEVER runs from seed/deploy. It preserves canonical definitions
 * (species, skills, items and their links) and refuses to touch a database
 * that contains any wallet-first player. Default mode is dry-run.
 *
 * Required for execution:
 *   CHAINMON_PLAYTEST_DATABASE_NAME=<exact database name>
 *   npx tsx scripts/production-playtest-reset.ts --database=<same name> --execute
 */

import { PrismaClient } from "@prisma/client";

type Counts = Record<string, number>;

function argument(name: string): string | undefined {
  return process.argv.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);
}

function databaseName(databaseUrl: string): string {
  try {
    const name = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ""));
    if (!name) throw new Error("empty database name");
    return name;
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL with a database name.");
  }
}

async function getCounts(prisma: PrismaClient): Promise<Counts> {
  const [
    users,
    trainers,
    monsters,
    monsterSkills,
    encounters,
    battles,
    battleMonsters,
    teamSlots,
    inventories,
    pickupClaims,
    spawns,
    listings,
    evolutions,
    onchainEvolutions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.trainer.count(),
    prisma.monster.count(),
    prisma.monsterSkill.count(),
    prisma.encounter.count(),
    prisma.battle.count(),
    prisma.battleMonster.count(),
    prisma.teamSlot.count(),
    prisma.inventory.count(),
    prisma.worldPickupClaim.count(),
    prisma.worldSpawn.count(),
    prisma.marketplaceListing.count(),
    prisma.monsterEvolution.count(),
    prisma.onchainEvolution.count(),
  ]);
  return {
    users,
    trainers,
    monsters,
    monsterSkills,
    encounters,
    battles,
    battleMonsters,
    teamSlots,
    inventories,
    pickupClaims,
    spawns,
    listings,
    evolutions,
    onchainEvolutions,
  };
}

async function protectedUserCount(prisma: PrismaClient): Promise<number> {
  // Wallet addresses are the public-playtest identity root. Do not expose user
  // records in output, only the aggregate safety result.
  return prisma.user.count();
}

async function main() {
  const expectedName = process.env.CHAINMON_PLAYTEST_DATABASE_NAME;
  const configuredUrl = process.env.DATABASE_URL;
  const suppliedName = argument("--database");
  const execute = process.argv.includes("--execute");

  if (!configuredUrl) throw new Error("DATABASE_URL is required.");
  if (!expectedName) {
    throw new Error("CHAINMON_PLAYTEST_DATABASE_NAME is required; refusing an unknown database.");
  }
  const actualName = databaseName(configuredUrl);
  if (actualName !== expectedName || suppliedName !== expectedName) {
    throw new Error("Target database confirmation does not exactly match DATABASE_URL; refusing to continue.");
  }

  const prisma = new PrismaClient();
  try {
    const protectedUsers = await protectedUserCount(prisma);
    const counts = await getCounts(prisma);
    console.log(JSON.stringify({ mode: execute ? "execute-requested" : "dry-run", target: actualName, protectedUsers, willDelete: counts }, null, 2));

    if (protectedUsers > 0) {
      throw new Error("Authenticated public users exist; reset stopped without deleting data.");
    }
    if (!execute) {
      console.log("Dry run only. Re-run with --execute after independently confirming the exact target.");
      return;
    }

    await prisma.$transaction(async (tx) => {
      const protectedInsideTransaction = await tx.user.count();
      if (protectedInsideTransaction > 0) {
        throw new Error("Wallet-authenticated public users appeared during reset preparation; transaction aborted.");
      }

      // Player/test state only. Canonical tables are intentionally absent:
      // monster_species, skills, monster_species_skills and items are retained.
      await tx.marketplaceListing.deleteMany();
      await tx.battleMonster.deleteMany();
      await tx.battle.deleteMany();
      await tx.teamSlot.deleteMany();
      await tx.onchainEvolution.deleteMany();
      await tx.monsterEvolution.deleteMany();
      await tx.monsterSkill.deleteMany();
      await tx.monster.deleteMany();
      await tx.encounter.deleteMany();
      await tx.inventory.deleteMany();
      await tx.worldPickupClaim.deleteMany();
      await tx.worldSpawn.deleteMany();
      await tx.walletLoginChallenge.deleteMany();
      await tx.trainer.deleteMany();
      await tx.user.deleteMany();
    });
    console.log("Playtest player state reset completed. Canonical definitions were preserved.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Playtest reset failed.");
  process.exitCode = 1;
});
