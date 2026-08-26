import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import { requireAuthenticatedTrainer, TrainerSessionError } from "@/lib/auth/trainer-session";
import { DAILY_SUPPLY_ITEMS } from "@/lib/services/world-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/world/daily-supply — claim the daily supply bundle.
 * Server guard: lastDailySupplyAt >= 24h (atomic updateMany — only one
 * concurrent request wins). Grants Basic ×5 + Great ×1.
 */
export async function POST() {
  try {
    const repository = await getRepository();
    const trainerId = await requireAuthenticatedTrainer(repository);

    const claim = await repository.claimDailySupplyBundle(
      trainerId,
      new Date(),
      DAILY_SUPPLY_ITEMS,
    );
    if (!claim.ok) {
      return NextResponse.json({ ok: false, error: claim.error }, { status: 400 });
    }

    const inventory = await repository.getInventory(trainerId);
    return NextResponse.json({
      ok: true,
      items: DAILY_SUPPLY_ITEMS,
      inventory: inventory.map((i) => ({ slug: i.slug, quantity: i.quantity })),
      nextAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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
