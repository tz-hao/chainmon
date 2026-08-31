import { PrismaClient } from "@prisma/client";

const PREVIEW_BRANCH = "feat/protocol-rift-expansion";

function shouldAuditPreviewBuild() {
  return (
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === PREVIEW_BRANCH
  );
}

function printUnavailableDatabase() {
  console.log("=== CHAINMON PREVIEW A/B DATABASE AUDIT ===");
  console.log("environment=preview");
  console.log("PREVIEW DATABASE NOT AVAILABLE DURING BUILD");
  console.log("=== END CHAINMON PREVIEW A/B DATABASE AUDIT ===");
}

async function main() {
  if (!shouldAuditPreviewBuild()) {
    console.log("[ChainMon DB Audit] skipped");
    return;
  }

  if (!process.env.DATABASE_URL) {
    printUnavailableDatabase();
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();

  try {
    const [users, trainers, playerMonsters, inventory, listings, encounters, battles] =
      await Promise.all([
        prisma.user.findMany({
          select: { walletAddress: true, trainer: { select: { id: true } } },
        }),
        prisma.trainer.findMany({ select: { id: true, userId: true, gold: true } }),
        prisma.monster.findMany({
          where: { ownerId: { not: null } },
          select: { ownerId: true, name: true },
        }),
        prisma.inventory.findMany({
          select: { trainerId: true, quantity: true, item: { select: { slug: true } } },
        }),
        prisma.marketplaceListing.count(),
        prisma.encounter.findMany({ select: { trainerId: true } }),
        prisma.battle.findMany({ select: { trainerId: true } }),
      ]);

    const normalizedWallets = new Map<string, number>();
    for (const user of users) {
      const wallet = user.walletAddress.trim().toLowerCase();
      normalizedWallets.set(wallet, (normalizedWallets.get(wallet) ?? 0) + 1);
    }
    const usersWithoutWalletIdentity = users.filter(
      (user) => user.walletAddress.trim().length === 0,
    ).length;
    const duplicateWalletIdentityGroups = [...normalizedWallets.values()].filter(
      (count) => count > 1,
    ).length;

    const trainerIds = new Set(trainers.map((trainer) => trainer.id));
    const linkedTrainerIds = users.flatMap((user) => (user.trainer ? [user.trainer.id] : []));
    const uniqueLinkedTrainerIds = new Set(linkedTrainerIds);
    const uniqueTrainerUserIds = new Set(trainers.map((trainer) => trainer.userId));
    const usersWithoutTrainer = users.filter((user) => !user.trainer).length;
    const trainerIdentityConflicts =
      uniqueTrainerUserIds.size !== trainers.length ||
      uniqueLinkedTrainerIds.size !== linkedTrainerIds.length ||
      linkedTrainerIds.length !== trainers.length ||
      linkedTrainerIds.some((trainerId) => !trainerIds.has(trainerId))
        ? 1
        : 0;

    const monstersByTrainer = new Map<string, string[]>();
    for (const monster of playerMonsters) {
      const trainerId = monster.ownerId!;
      const names = monstersByTrainer.get(trainerId) ?? [];
      names.push(monster.name);
      monstersByTrainer.set(trainerId, names);
    }
    const orphanPlayerMonsters = playerMonsters.filter(
      (monster) => !trainerIds.has(monster.ownerId!),
    ).length;
    const trainerMonsterCounts = trainers
      .map((trainer) => monstersByTrainer.get(trainer.id)?.length ?? 0)
      .sort((left, right) => left - right);
    const monsterSpeciesDistributions = trainers
      .map((trainer) => [...(monstersByTrainer.get(trainer.id) ?? [])].sort())
      .sort((left, right) => left.join("|").localeCompare(right.join("|")));

    const inventoryByTrainer = new Map(
      trainers.map((trainer) => [
        trainer.id,
        { gold: trainer.gold, basic: 0, great: 0, ultra: 0 },
      ]),
    );
    let inventoryRecordsWithoutTrainer = 0;
    for (const entry of inventory) {
      const summary = inventoryByTrainer.get(entry.trainerId);
      if (!summary) {
        inventoryRecordsWithoutTrainer += 1;
        continue;
      }
      if (entry.item.slug === "basic-ball") summary.basic += entry.quantity;
      if (entry.item.slug === "great-ball") summary.great += entry.quantity;
      if (entry.item.slug === "ultra-ball") summary.ultra += entry.quantity;
    }
    const inventorySummaries = [...inventoryByTrainer.values()].sort(
      (left, right) => left.gold - right.gold,
    );
    const inventoryOwnerConflicts = inventoryRecordsWithoutTrainer;
    const inventoryOwnershipValid = inventoryOwnerConflicts === 0;
    const gold63TrainerMonsterCount2 = trainers.some(
      (trainer) => trainer.gold === 63 && (monstersByTrainer.get(trainer.id)?.length ?? 0) === 2,
    );
    const gold68TrainerMonsterCount2 = trainers.some(
      (trainer) => trainer.gold === 68 && (monstersByTrainer.get(trainer.id)?.length ?? 0) === 2,
    );
    const orphanCaptureRecords = encounters.filter(
      (encounter) => !trainerIds.has(encounter.trainerId),
    ).length;
    const orphanBattleRecords = battles.filter(
      (battle) => !trainerIds.has(battle.trainerId),
    ).length;

    const expectedSpeciesDistributions = [
      ["FireCub", "OracleOwl"],
      ["FireCub", "Swapicorn"],
    ];
    const legacyIdentityRows = usersWithoutWalletIdentity;
    const isolationPassed =
      users.length === 2 &&
      normalizedWallets.size === 2 &&
      usersWithoutWalletIdentity === 0 &&
      duplicateWalletIdentityGroups === 0 &&
      trainers.length === 2 &&
      usersWithoutTrainer === 0 &&
      trainerIdentityConflicts === 0 &&
      playerMonsters.length === 4 &&
      trainerMonsterCounts.join(",") === "2,2" &&
      JSON.stringify(monsterSpeciesDistributions) ===
        JSON.stringify(expectedSpeciesDistributions) &&
      orphanPlayerMonsters === 0 &&
      inventoryOwnershipValid &&
      gold63TrainerMonsterCount2 &&
      gold68TrainerMonsterCount2 &&
      listings === 0 &&
      legacyIdentityRows === 0;

    console.log("=== CHAINMON PREVIEW A/B DATABASE AUDIT ===");
    console.log("environment=preview");
    console.log(`users=${users.length}`);
    console.log(`uniqueWalletIdentities=${normalizedWallets.size}`);
    console.log(`usersWithoutWalletIdentity=${usersWithoutWalletIdentity}`);
    console.log(`duplicateWalletIdentityGroups=${duplicateWalletIdentityGroups}`);
    console.log(`trainers=${trainers.length}`);
    console.log(`usersWithoutTrainer=${usersWithoutTrainer}`);
    console.log(`trainerIdentityConflicts=${trainerIdentityConflicts}`);
    console.log(`playerMonsters=${playerMonsters.length}`);
    console.log(`trainerMonsterCounts=${JSON.stringify(trainerMonsterCounts)}`);
    console.log(`monsterSpeciesDistributions=${JSON.stringify(monsterSpeciesDistributions)}`);
    console.log(`orphanPlayerMonsters=${orphanPlayerMonsters}`);
    console.log(`inventoryOwnershipValid=${inventoryOwnershipValid}`);
    console.log(`inventoryOwnerConflicts=${inventoryOwnerConflicts}`);
    console.log(`inventoryRecordsWithoutTrainer=${inventoryRecordsWithoutTrainer}`);
    console.log(`inventorySummaries=${JSON.stringify(inventorySummaries)}`);
    console.log(`gold63TrainerMonsterCount2=${gold63TrainerMonsterCount2}`);
    console.log(`gold68TrainerMonsterCount2=${gold68TrainerMonsterCount2}`);
    console.log(`listings=${listings}`);
    console.log(`legacyIdentityRows=${legacyIdentityRows}`);
    console.log(`orphanCaptureRecords=${orphanCaptureRecords}`);
    console.log(`orphanBattleRecords=${orphanBattleRecords}`);
    console.log(`isolation=${isolationPassed ? "PASS" : "FAIL"}`);
    console.log("=== END CHAINMON PREVIEW A/B DATABASE AUDIT ===");

    if (!isolationPassed) process.exitCode = 1;
  } catch {
    printUnavailableDatabase();
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
