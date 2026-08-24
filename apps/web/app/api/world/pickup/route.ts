import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import { getPickupReward } from "@/lib/services/world-service";
import { buildChainMonValley } from "@/lib/world/map-data";
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
    const trainer = await repository.getDemoTrainer();
    if (!trainer) {
      return NextResponse.json({ error: "Create a trainer first." }, { status: 400 });
    }
    const marker = buildChainMonValley().pickups.find((pickup) => pickup.pickupKey === pickupKey);
    const position = await repository.getTrainerWorldPosition(trainer.id);
    if (!marker || !position || !isWithinWorldInteractionDistance(position, marker)) {
      return NextResponse.json({ ok: false, error: "Move closer to this pickup." }, { status: 400 });
    }

    const result = await repository.claimPickupReward(
      trainer.id,
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

    const inventory = await repository.getInventory(trainer.id);
    return NextResponse.json({
      ok: true,
      reward,
      goldAfter: result.goldAfter,
      inventory: inventory.map((i) => ({ slug: i.slug, quantity: i.quantity })),
      message: reward.itemSlug
        ? `Found ${reward.quantity}× ${reward.itemSlug.replace(/-/g, " ")}!`
        : `Found ${reward.gold} gold!`,
    });
  } catch {
    return NextResponse.json(
      { error: "World temporarily unavailable." },
      { status: 503 },
    );
  }
}
