import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import { requireAuthenticatedTrainer, TrainerSessionError } from "@/lib/auth/trainer-session";
import { reconcileWorldSpawns, getPickupReward } from "@/lib/services/world-service";
import { PICKUP_COOLDOWN_MS, DAILY_SUPPLY_COOLDOWN_MS } from "@/lib/world/world-config";
import { DAILY_SUPPLY_ITEMS } from "@/lib/services/world-service";
import { buildWorldMap } from "@/lib/world/map-data";
import { normalizeWorldMapId } from "@/lib/world/world-maps";

export const dynamic = "force-dynamic";

/**
 * GET /api/world/state — server-authoritative world snapshot:
 * trainer position, reconciled wild spawns, pickups, daily supply state
 * and inventory. Clients never decide species/rarity/levels.
 */
export async function GET() {
  try {
    const repository = await getRepository();
    const trainerId = await requireAuthenticatedTrainer(repository);
    const trainer = await repository.getTrainerById(trainerId);
    if (!trainer) throw new TrainerSessionError();
    const position = await repository.getTrainerWorldPosition(trainer.id);
    const worldMap = normalizeWorldMapId(position?.worldMap);
    const map = buildWorldMap(worldMap);
    if (position?.worldMap !== worldMap) {
      await repository.saveTrainerWorldPosition(trainer.id, {
        worldMap,
        worldX: map.spawnPoint.x,
        worldY: map.spawnPoint.y,
      });
    }
    const spawns = await reconcileWorldSpawns(repository, worldMap);

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

    let dailySupply = { ready: false, nextAt: null as string | null };
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

    const inventory = await repository.getInventory(trainer.id);

    return NextResponse.json({
      trainer: {
        id: trainer.id,
        nickname: trainer.nickname,
        gold: trainer.gold,
        worldMap,
        worldX: position?.worldMap === worldMap ? position.worldX : map.spawnPoint.x,
        worldY: position?.worldMap === worldMap ? position.worldY : map.spawnPoint.y,
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
  } catch (error) {
    if (error instanceof TrainerSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: "World temporarily unavailable." },
      { status: 503 },
    );
  }
}
