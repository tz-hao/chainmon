import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Ball Merchant price list (gold per capsule). */
const SHOP_PRICES: Record<string, number> = {
  "basic-ball": 25,
  "great-ball": 80,
  "ultra-ball": 240,
};

const SHOP_NAMES: Record<string, string> = {
  "basic-ball": "Basic Capsule",
  "great-ball": "Great Capsule",
  "ultra-ball": "Ultra Capsule",
};

/**
 * POST /api/world/shop — server-verified purchase. Gold check, deduction
 * and inventory grant run in ONE database transaction. Clients cannot
 * change their own inventory.
 */
export async function POST(request: Request) {
  let body: { itemSlug?: string; quantity?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const itemSlug = body.itemSlug;
  const quantity = body.quantity;
  const unitPrice = itemSlug ? SHOP_PRICES[itemSlug] : undefined;
  if (!itemSlug || unitPrice === undefined || !quantity || quantity <= 0 || quantity > 10) {
    return NextResponse.json(
      { error: "itemSlug + quantity (1-10) are required." },
      { status: 400 },
    );
  }

  try {
    const repository = await getRepository();
    const trainer = await repository.getDemoTrainer();
    if (!trainer) {
      return NextResponse.json({ error: "Create a trainer first." }, { status: 400 });
    }
    const result = await repository.purchaseShopItem(
      trainer.id,
      itemSlug,
      quantity,
      unitPrice,
    );
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    const inventory = await repository.getInventory(trainer.id);
    return NextResponse.json({
      ok: true,
      goldAfter: result.goldAfter,
      itemName: SHOP_NAMES[itemSlug] ?? itemSlug,
      inventory: inventory.map((i) => ({ slug: i.slug, quantity: i.quantity })),
    });
  } catch {
    return NextResponse.json(
      { error: "Shop temporarily unavailable." },
      { status: 503 },
    );
  }
}
