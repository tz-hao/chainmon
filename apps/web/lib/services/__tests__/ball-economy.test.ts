import { describe, expect, it } from "vitest";
import { createTrainerWithStarter } from "../../data/demo-service";
import { memoryRepository, resetMemoryRepository } from "../../data/memory-repository";
import { rollEvolutionItemReward, rollItemReward } from "@chainmon/game-engine";
import { STARTER_INVENTORY } from "../../data/starter-inventory";
import { PICKUP_REWARDS, DAILY_SUPPLY_ITEMS } from "../../services/world-service";

describe("starter ball supply", () => {
  it("grants Basic ×20 / Great ×5 / Ultra ×2 to a new trainer", () => {
    resetMemoryRepository();
    expect(STARTER_INVENTORY).toEqual({
      "basic-ball": 20,
      "great-ball": 5,
      "ultra-ball": 2,
    });
  });

  it("starter supply is granted exactly once (starterSupplyClaimed guard)", async () => {
    resetMemoryRepository();
    const { trainer } = await createTrainerWithStarter(memoryRepository, "Ash", "firecub");
    // createTrainerWithStarter already granted the starter supply once —
    // a second grant must be a no-op.
    const second = await memoryRepository.grantStarterSupply(trainer.id);
    expect(second).toBe(false);
    const inventory = await memoryRepository.getInventory(trainer.id);
    expect(inventory.find((i) => i.slug === "basic-ball")?.quantity).toBe(20);
    expect(inventory.find((i) => i.slug === "great-ball")?.quantity).toBe(5);
    expect(inventory.find((i) => i.slug === "ultra-ball")?.quantity).toBe(2);
  });
});

describe("shop purchases (server-authoritative)", () => {
  it("succeeds with enough gold and deducts atomically", async () => {
    resetMemoryRepository();
    const { trainer } = await createTrainerWithStarter(memoryRepository, "Ash", "firecub");
    await memoryRepository.addGold(trainer.id, 500);
    const result = await memoryRepository.purchaseShopItem(trainer.id, "basic-ball", 5, 25);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.goldAfter).toBe(375);
    const inventory = await memoryRepository.getInventory(trainer.id);
    expect(inventory.find((i) => i.slug === "basic-ball")?.quantity).toBe(25); // 20 starter + 5
  });

  it("rejects when gold is insufficient", async () => {
    resetMemoryRepository();
    const { trainer } = await createTrainerWithStarter(memoryRepository, "Ash", "firecub");
    const result = await memoryRepository.purchaseShopItem(trainer.id, "ultra-ball", 1, 240);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("gold");
  });

  it("allows only one concurrent purchase to spend the last gold", async () => {
    resetMemoryRepository();
    const { trainer } = await createTrainerWithStarter(memoryRepository, "Ash", "firecub");
    await memoryRepository.addGold(trainer.id, 25);
    const results = await Promise.all([
      memoryRepository.purchaseShopItem(trainer.id, "basic-ball", 1, 25),
      memoryRepository.purchaseShopItem(trainer.id, "basic-ball", 1, 25),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect((await memoryRepository.getInventory(trainer.id)).find((item) => item.slug === "basic-ball")?.quantity).toBe(21);
  });

  it("supports ×1 / ×5 / ×10 quantities", async () => {
    resetMemoryRepository();
    const { trainer } = await createTrainerWithStarter(memoryRepository, "Ash", "firecub");
    await memoryRepository.addGold(trainer.id, 5000);
    const ten = await memoryRepository.purchaseShopItem(trainer.id, "great-ball", 10, 80);
    expect(ten.ok).toBe(true);
    const inventory = await memoryRepository.getInventory(trainer.id);
    expect(inventory.find((i) => i.slug === "great-ball")?.quantity).toBe(15); // 5 + 10
  });
});

describe("world pickups", () => {
  it("defines 5-8 pickup rewards with items or gold", () => {
    const keys = Object.keys(PICKUP_REWARDS);
    expect(keys.length).toBeGreaterThanOrEqual(5);
    expect(keys.length).toBeLessThanOrEqual(8);
    for (const key of keys) {
      const reward = PICKUP_REWARDS[key]!;
      expect(reward.itemSlug || reward.gold).toBeTruthy();
    }
    // Vault chest grants an Ultra Capsule
    expect(PICKUP_REWARDS["vault-chest-1"]).toEqual({ itemSlug: "ultra-ball", quantity: 1 });
  });

  it("claim is unique per trainer + key (double request loses)", async () => {
    resetMemoryRepository();
    const { trainer } = await createTrainerWithStarter(memoryRepository, "Ash", "firecub");
    const now = new Date();
    const first = await memoryRepository.claimPickup(trainer.id, "forest-spark-1", now);
    const second = await memoryRepository.claimPickup(trainer.id, "forest-spark-1", now);
    expect(first).toBe("claimed");
    expect(second).toBe("cooldown");
  });

  it("cooldown is server-verified (claims list exposes claimedAt)", async () => {
    resetMemoryRepository();
    const { trainer } = await createTrainerWithStarter(memoryRepository, "Ash", "firecub");
    await memoryRepository.claimPickup(trainer.id, "lake-spark-1", new Date());
    const claims = await memoryRepository.getPickupClaims(trainer.id);
    expect(claims).toHaveLength(1);
    expect(claims[0]!.claimedAt).toBeInstanceOf(Date);
  });

  it("updates the pickup marker and reward together, then permits the next cooldown window", async () => {
    resetMemoryRepository();
    const { trainer } = await createTrainerWithStarter(memoryRepository, "Ash", "firecub");
    const now = new Date("2026-01-01T00:00:00Z");
    const first = await memoryRepository.claimPickupReward(
      trainer.id,
      "forest-spark-1",
      now,
      10 * 60 * 1000,
      PICKUP_REWARDS["forest-spark-1"]!,
    );
    const duplicate = await memoryRepository.claimPickupReward(
      trainer.id,
      "forest-spark-1",
      new Date(now.getTime() + 1),
      10 * 60 * 1000,
      PICKUP_REWARDS["forest-spark-1"]!,
    );
    const afterCooldown = await memoryRepository.claimPickupReward(
      trainer.id,
      "forest-spark-1",
      new Date(now.getTime() + 10 * 60 * 1000),
      10 * 60 * 1000,
      PICKUP_REWARDS["forest-spark-1"]!,
    );
    expect(first.ok).toBe(true);
    expect(duplicate).toEqual({ ok: false, error: "cooldown" });
    expect(afterCooldown.ok).toBe(true);
    expect((await memoryRepository.getInventory(trainer.id)).find((item) => item.slug === "basic-ball")?.quantity).toBe(24);
  });
});

describe("daily supply", () => {
  it("bundle is Basic ×5 + Great ×1", () => {
    expect(DAILY_SUPPLY_ITEMS).toEqual([
      { itemSlug: "basic-ball", quantity: 5 },
      { itemSlug: "great-ball", quantity: 1 },
    ]);
  });

  it("first claim succeeds; immediate second claim fails (double request guard)", async () => {
    resetMemoryRepository();
    const { trainer } = await createTrainerWithStarter(memoryRepository, "Ash", "firecub");
    const first = await memoryRepository.claimDailySupply(trainer.id, new Date());
    const second = await memoryRepository.claimDailySupply(trainer.id, new Date());
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
  });

  it("claim succeeds again after 24h", async () => {
    resetMemoryRepository();
    const { trainer } = await createTrainerWithStarter(memoryRepository, "Ash", "firecub");
    await memoryRepository.claimDailySupply(trainer.id, new Date("2026-01-01T00:00:00Z"));
    const next = await memoryRepository.claimDailySupply(
      trainer.id,
      new Date("2026-01-02T00:00:01Z"),
    );
    expect(next.ok).toBe(true);
  });

  it("grants the complete bundle exactly once under concurrent requests", async () => {
    resetMemoryRepository();
    const { trainer } = await createTrainerWithStarter(memoryRepository, "Ash", "firecub");
    const now = new Date();
    const results = await Promise.all([
      memoryRepository.claimDailySupplyBundle(trainer.id, now, DAILY_SUPPLY_ITEMS),
      memoryRepository.claimDailySupplyBundle(trainer.id, now, DAILY_SUPPLY_ITEMS),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const inventory = await memoryRepository.getInventory(trainer.id);
    expect(inventory.find((item) => item.slug === "basic-ball")?.quantity).toBe(25);
    expect(inventory.find((item) => item.slug === "great-ball")?.quantity).toBe(6);
  });
});

describe("battle ball drops", () => {
  it("victory: no drop below 0.58, Basic in [0.58,0.88), Great in [0.88,0.98), Ultra ≥0.98", () => {
    expect(rollItemReward("player", { next: () => 0.3 })).toBeNull();
    expect(rollItemReward("player", { next: () => 0.7 })).toEqual({ itemSlug: "basic-ball", quantity: 1 });
    expect(rollItemReward("player", { next: () => 0.93 })).toEqual({ itemSlug: "great-ball", quantity: 1 });
    expect(rollItemReward("player", { next: () => 0.99 })).toEqual({ itemSlug: "ultra-ball", quantity: 1 });
  });

  it("defeat: Basic only for rolls ≥0.92 (8%)", () => {
    expect(rollItemReward("opponent", { next: () => 0.5 })).toBeNull();
    expect(rollItemReward("opponent", { next: () => 0.95 })).toEqual({ itemSlug: "basic-ball", quantity: 1 });
  });

  it("legacy fire stone drop is preserved via rollEvolutionItemReward", () => {
    expect(rollEvolutionItemReward(true, { next: () => 0.005 })).toEqual({ itemSlug: "fire-stone", quantity: 1 });
    expect(rollEvolutionItemReward(true, { next: () => 0.5 })).toBeNull();
    expect(rollEvolutionItemReward(false, { next: () => 0.005 })).toBeNull();
  });
});
