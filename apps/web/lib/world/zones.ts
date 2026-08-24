/**
 * ChainMon Pixel World — zone definitions (tile coordinates).
 * ChainMon Valley layout (section 9): a complete loop.
 *
 *                Cold Vault
 *                    │
 *       Forest ── Camp ── Power Zone
 *         │          │          │
 *   Liquidity      Meadow    Portal
 *     Grove                   Gate
 *         │          │
 *       Lake ─── Path ─── Volcano
 */

import type { WorldZone, ZoneId } from "./world-types";

export const WORLD_ZONES: readonly WorldZone[] = [
  { id: "camp", name: "Trainer Camp", x: 26, y: 20, width: 12, height: 10 },
  { id: "forest", name: "Whispering Forest", x: 2, y: 6, width: 22, height: 14 },
  { id: "lake", name: "Lake", x: 2, y: 30, width: 22, height: 12 },
  { id: "volcano", name: "Volcano", x: 44, y: 30, width: 18, height: 12 },
  { id: "power-zone", name: "Power Zone", x: 42, y: 6, width: 20, height: 14 },
  { id: "grove", name: "Liquidity Grove", x: 2, y: 24, width: 10, height: 6 },
  { id: "vault", name: "Cold Vault", x: 28, y: 0, width: 8, height: 6 },
];

export function getZoneById(id: string): WorldZone | undefined {
  return WORLD_ZONES.find((z) => z.id === id);
}

export function zoneAt(x: number, y: number): WorldZone | undefined {
  return WORLD_ZONES.find(
    (z) => x >= z.x && x < z.x + z.width && y >= z.y && y < z.y + z.height,
  );
}

export function zoneNameAt(x: number, y: number): string {
  return zoneAt(x, y)?.name ?? "Meadow";
}

/** Deterministic pseudo-random (seeded) — used only for CLIENT idle visuals. */
export function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export type { ZoneId };
