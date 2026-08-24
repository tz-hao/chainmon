/**
 * Starter inventory granted once when the Demo Trainer is created.
 * Granting must be idempotent — never re-grant on repeated logins/refreshes
 * (guard: Trainer.starterSupplyClaimed / memory flag).
 * Pixel World Upgrade (section 28): Basic ×20 · Great ×5 · Ultra ×2.
 */

export const STARTER_INVENTORY: Record<string, number> = {
  "basic-ball": 20,
  "great-ball": 5,
  "ultra-ball": 2,
};

export const STARTER_BALL_SLUGS: readonly string[] = [
  "basic-ball",
  "great-ball",
  "ultra-ball",
];
