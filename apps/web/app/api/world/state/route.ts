import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import { reconcileWorldSpawns, getPickupReward } from "@/lib/services/world-service";
import { PICKUP_COOLDOWN_MS, DAILY_SUPPLY_COOLDOWN_MS } from "@/lib/world/world-config";
import { DAILY_SUPPLY_ITEMS } from "@/lib/services/world-service";
import { buildChainMonValley } from "@/lib/world/map-data";

export const dynamic = "force-dynamic";

/**
 * GET /api/world/state — server-authoritative world snapshot:
 * trainer position, reconciled wild spawns, pickups, daily supply state
 * and inventory. Clients never decide species/rarity/levels.
 */
export async function GET() {
  try {
    const repository = await getRepository();
    const trainer = await repository.getDemoTrainer();
    const spawns = await reconcileWorldSpawns(repository);

    const map = buildChainMonValley();
    const now = new Date();
    const pickups = map.pickups.map((p) => ({
      ...p,
      kind:
        p.pickupKey.includes("chest")
          ? ("gold-chest" as const)
          : p.pickupKey.includes("grove") || p.pickupKey.includes("lake")
            ? ("purple-spark" as const)
            : ("blue-spark" as const),
      x: p.x,
      y: p.y,
      available: true,
      nextAt: null as string | null,
    }));

    if (trainer) {
      const claims = await repository.getPickupClaims(trainer.id);
      for (const pickup of pickups) {
        const claim = claims.find((c) => c.pickupKey === pickup.pickupKey);
        if (claim) {
          const elapsed = now.getTime() - claim.claimedAt.getTime();
          const remaining = PICKUP_COOLDOWN_MS - elapsed;
          pickup.available = remaining <= 0;
          pickup.nextAt = remaining > 0 ? new Date(now.getTime() + remaining).toISOString() : null;
        }
      }
    }

    const position = trainer
      ? await repository.getTrainerWorldPosition(trainer.id)
      : null;

    let dailySupply = { ready: false, nextAt: null as string | null };
    if (trainer) {
      const ds = await repository.getDailySupplyState(trainer.id);
      if (!ds.lastClaimedAt) {
        dailySupply = { ready: true, nextAt: null };
      } else {
        const elapsed = now.getTime() - ds.lastClaimedAt.getTime();
        const remaining = DAILY_SUPPLY_COOLDOWN_MS - elapsed;
        dailySupply = {
          ready: remaining <= 0,
          nextAt:
            remaining > 0 ? new Date(now.getTime() + remaining).toISOString() : null,
        };
      }
    }

    const inventory = trainer
      ? await repository.getInventory(trainer.id)
      : [];

    return NextResponse.json({
      trainer: {
        id: trainer?.id ?? "",
        nickname: trainer?.nickname ?? "Trainer",
        gold: trainer?.gold ?? 0,
        worldX: position?.worldX ?? 30,
        worldY: position?.worldY ?? 24,
        zoneId: null,
      },
      spawns: spawns
        .filter((s) => s.expiresAt > new Date())
        .map((s) => ({
          spawnId: s.id,
          speciesId: s.speciesId,
          zoneId: s.zoneId,
          x: s.x,
          y: s.y,
          level: s.level,
          expiresAt: s.expiresAt.toISOString(),
        })),
      pickups,
      dailySupply,
      inventory: inventory.map((i) => ({ slug: i.slug, quantity: i.quantity })),
    });
  } catch {
    return NextResponse.json(
      { error: "World temporarily unavailable." },
      { status: 503 },
    );
  }
}
