import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function unavailable() {
  return new NextResponse(null, { status: 404, headers: NO_STORE_HEADERS });
}

function hasValidAuditToken(request: NextRequest): boolean {
  const expected = process.env.CHAINMON_PREVIEW_AUDIT_TOKEN;
  const authorization = request.headers.get("authorization");
  if (!expected || !authorization?.startsWith("Bearer ")) return false;

  const supplied = Buffer.from(authorization.slice("Bearer ".length));
  const configured = Buffer.from(expected);
  return supplied.length === configured.length && timingSafeEqual(supplied, configured);
}

/**
 * Temporary, Preview-only A/B isolation audit. All reads are hard-coded and
 * its response intentionally contains no ids, wallets, tokens, or secrets.
 */
export async function GET(request: NextRequest) {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    request.nextUrl.search ||
    !hasValidAuditToken(request)
  ) {
    return unavailable();
  }

  try {
    const [users, trainers, ownedMonsters, inventory, listings, encounters, battles] =
      await Promise.all([
        prisma.user.findMany({
          select: { walletAddress: true, trainer: { select: { id: true } } },
        }),
        prisma.trainer.findMany({ select: { id: true, gold: true } }),
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
    const usersWithoutWalletIdentity = users.filter((user) => !user.walletAddress.trim()).length;
    const duplicateWalletIdentityGroups = [...normalizedWallets.values()].filter(
      (count) => count > 1,
    ).length;

    const trainerIds = new Set(trainers.map((trainer) => trainer.id));
    const linkedTrainerIds = users.flatMap((user) => (user.trainer ? [user.trainer.id] : []));
    const usersWithoutTrainer = users.filter((user) => !user.trainer).length;
    const trainerIdentityConflicts =
      linkedTrainerIds.length !== new Set(linkedTrainerIds).size ||
      linkedTrainerIds.length !== trainerIds.size
        ? 1
        : 0;

    const monstersByTrainer = new Map<string, string[]>();
    for (const monster of ownedMonsters) {
      const ownerId = monster.ownerId!;
      const names = monstersByTrainer.get(ownerId) ?? [];
      names.push(monster.name);
      monstersByTrainer.set(ownerId, names);
    }
    const orphanPlayerMonsters = ownedMonsters.filter(
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
    const walletAInventoryPreserved = inventorySummaries.some(
      (summary) =>
        summary.gold === 63 &&
        summary.basic === 21 &&
        summary.great === 6 &&
        summary.ultra === 2,
    );
    const inventoryOwnerConflicts = inventoryRecordsWithoutTrainer;
    const orphanCaptureRecords = encounters.filter((encounter) => !trainerIds.has(encounter.trainerId)).length;
    const orphanBattleRecords = battles.filter((battle) => !trainerIds.has(battle.trainerId)).length;

    const expectedSpecies = [
      ["FireCub", "OracleOwl"],
      ["FireCub", "Swapicorn"],
    ];
    const isolationPassed =
      users.length === 2 &&
      normalizedWallets.size === 2 &&
      usersWithoutWalletIdentity === 0 &&
      duplicateWalletIdentityGroups === 0 &&
      trainers.length === 2 &&
      usersWithoutTrainer === 0 &&
      trainerIdentityConflicts === 0 &&
      ownedMonsters.length === 4 &&
      trainerMonsterCounts.join(",") === "2,2" &&
      JSON.stringify(monsterSpeciesDistributions) === JSON.stringify(expectedSpecies) &&
      orphanPlayerMonsters === 0 &&
      inventoryOwnerConflicts === 0 &&
      listings === 0 &&
      walletAInventoryPreserved;

    return NextResponse.json(
      {
        environment: "preview",
        database: "ok",
        users: users.length,
        uniqueWalletIdentities: normalizedWallets.size,
        usersWithoutWalletIdentity,
        duplicateWalletIdentityGroups,
        walletIdentityUniqueConstraint: true,
        trainers: trainers.length,
        usersWithoutTrainer,
        trainerIdentityConflicts,
        trainerOneToOneRelationEnforced: true,
        playerMonsters: ownedMonsters.length,
        trainerMonsterCounts,
        monsterSpeciesDistributions,
        orphanPlayerMonsters,
        singleOwnerRelationEnforced: true,
        inventoryOwnershipValid: inventoryOwnerConflicts === 0,
        inventoryOwnerConflicts,
        inventoryRecordsWithoutTrainer,
        inventorySummaries,
        walletAInventoryPreserved,
        listings,
        legacyIdentityRows: usersWithoutWalletIdentity,
        orphanCaptureRecords,
        orphanBattleRecords,
        isolation: isolationPassed ? "pass" : "fail",
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch {
    return NextResponse.json(
      { error: "Preview audit temporarily unavailable." },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}
