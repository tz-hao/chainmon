import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import { requireAuthenticatedTrainer, TrainerSessionError } from "@/lib/auth/trainer-session";
import { getPickupReward } from "@/lib/services/world-service";
import { buildWorldMap } from "@/lib/world/map-data";
import { normalizeWorldMapId } from "@/lib/world/world-maps";
import { PICKUP_COOLDOWN_MS } from "@/lib/world/world-config";
import { isWithinWorldInteractionDistance } from "@/lib/services/world-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/world/pickup — claim a glowing pickup node.
 * Server-side: unique(trainerId, pickupKey) + cooldown. The reward comes
 * from the server table — clients never decide it.
 */
export async function POST(request: Request) {
  let body: { pickupKey?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const pickupKey = body.pickupKey;
  const reward = pickupKey ? getPickupReward(pickupKey) : null;
  if (!pickupKey || !reward) {
    return NextResponse.json({ error: "Unknown pickup." }, { status: 400 });
  }

  try {
    const repository = await getRepository();
    const trainerId = await requireAuthenticatedTrainer(repository);
    const position = await repository.getTrainerWorldPosition(trainerId);
    const marker = buildWorldMap(normalizeWorldMapId(position?.worldMap)).pickups.find(
      (pickup) => pickup.pickupKey === pickupKey,
    );
    if (!marker || !position || !isWithinWorldInteractionDistance(position, marker)) {
      return NextResponse.json({ ok: false, error: "Move closer to this pickup." }, { status: 400 });
    }

    const result = await repository.claimPickupReward(
      trainerId,
      pickupKey,
      new Date(),
      PICKUP_COOLDOWN_MS,
      reward,
    );
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            result.error === "cooldown"
              ? "This pickup is still cooling down."
              : "Pickup is temporarily unavailable.",
        },
        { status: 400 },
      );
    }

    const inventory = await repository.getInventory(trainerId);
    return NextResponse.json({
      ok: true,
      reward,
      goldAfter: result.goldAfter,
      inventory: inventory.map((i) => ({ slug: i.slug, quantity: i.quantity })),
      message: reward.itemSlug
        ? `Found ${reward.quantity}× ${reward.itemSlug.replace(/-/g, " ")}!`
        : `Found ${reward.gold} gold!`,
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
