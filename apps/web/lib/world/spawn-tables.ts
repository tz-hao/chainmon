/**
 * ChainMon Pixel World — wild spawn tables (server-authoritative).
 * Zone → weighted species list. Legendaries spawn at very low weight and
 * only in specific zones (never a normal meadow).
 */

import type { ZoneId } from "./world-types";

export interface SpawnTableEntry {
  speciesId: number;
  /** relative weight — higher = more common */
  weight: number;
  /** allowed level range [min, max] */
  levelMin: number;
  levelMax: number;
}

export const SPAWN_TABLES: Record<ZoneId, readonly SpawnTableEntry[]> = {
  // Forest: LeafCat / BloomMantis / MossBear / ThornDeer, AncientTreant (very low)
  forest: [
    { speciesId: 11, weight: 30, levelMin: 2, levelMax: 6 },
    { speciesId: 12, weight: 22, levelMin: 3, levelMax: 7 },
    { speciesId: 13, weight: 18, levelMin: 4, levelMax: 8 },
    { speciesId: 14, weight: 20, levelMin: 3, levelMax: 7 },
    { speciesId: 15, weight: 2, levelMin: 8, levelMax: 10 }, // Legendary — very low
  ],

  // Lake: AquaTurtle / BubbleFin / TideOtter / CoralSerpent, AbyssShark (very low)
  lake: [
    { speciesId: 6, weight: 30, levelMin: 2, levelMax: 6 },
    { speciesId: 7, weight: 22, levelMin: 3, levelMax: 7 },
    { speciesId: 8, weight: 20, levelMin: 3, levelMax: 6 },
    { speciesId: 9, weight: 16, levelMin: 4, levelMax: 8 },
    { speciesId: 10, weight: 2, levelMin: 9, levelMax: 11 }, // Legendary — very low
  ],

  // Volcano: FireCub / EmberFox / MagmaBoar / GasGoblin / BridgeFox
  volcano: [
    { speciesId: 1, weight: 26, levelMin: 2, levelMax: 6 },
    { speciesId: 4, weight: 18, levelMin: 3, levelMax: 7 },
    { speciesId: 5, weight: 16, levelMin: 4, levelMax: 8 },
    { speciesId: 26, weight: 14, levelMin: 2, levelMax: 5 }, // GasGoblin
    { speciesId: 24, weight: 12, levelMin: 3, levelMax: 6 }, // BridgeFox
  ],

  // Power Zone: SparkMouse / StaticLynx / VoltHare / StormDragon / ThunderBird / ZkBat
  "power-zone": [
    { speciesId: 16, weight: 24, levelMin: 2, levelMax: 6 },
    { speciesId: 17, weight: 18, levelMin: 3, levelMax: 7 },
    { speciesId: 19, weight: 16, levelMin: 3, levelMax: 6 },
    { speciesId: 18, weight: 8, levelMin: 6, levelMax: 10 }, // Epic
    { speciesId: 20, weight: 8, levelMin: 6, levelMax: 10 }, // Epic
    { speciesId: 23, weight: 10, levelMin: 4, levelMax: 8 }, // ZkBat (Epic)
  ],

  // Web3 / Liquidity Grove: Swapicorn / OracleOwl / MevMantis; Lendgeist at the water edge
  grove: [
    { speciesId: 21, weight: 30, levelMin: 3, levelMax: 7 }, // Swapicorn
    { speciesId: 22, weight: 24, levelMin: 3, levelMax: 7 }, // OracleOwl
    { speciesId: 27, weight: 14, levelMin: 5, levelMax: 9 }, // MevMantis (Epic)
    { speciesId: 25, weight: 16, levelMin: 4, levelMax: 8 }, // Lendgeist (Epic, water edge)
  ],

  // Cold Vault (hidden): VaultTurtle only, very low weight (~1-2% presence)
  vault: [
    { speciesId: 28, weight: 2, levelMin: 10, levelMax: 12 }, // Legendary — vault only
  ],

  // Camp: no wild spawns (safe zone)
  camp: [],
};

/** Weighted pick (deterministic via injected random source). */
export function pickSpawnEntry(
  zone: ZoneId,
  next: () => number,
): SpawnTableEntry | null {
  const table = SPAWN_TABLES[zone] ?? [];
  if (table.length === 0) return null;
  const total = table.reduce((sum, e) => sum + e.weight, 0);
  let roll = next() * total;
  for (const entry of table) {
    roll -= entry.weight;
    if (roll < 0) return entry;
  }
  return table[table.length - 1]!;
}

export function spawnLevel(entry: SpawnTableEntry, next: () => number): number {
  const span = entry.levelMax - entry.levelMin;
  return entry.levelMin + Math.floor(next() * (span + 1));
}
