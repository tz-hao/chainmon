/**
 * ChainMon Pixel World — server-authoritative world service.
 * Spawn reconciliation, encounter start (delegates to the existing capture
 * pipeline), shop purchases, pickups, daily supply and position saves.
 *
 * Clients submit ids only — species / rarity / level / catch rates are
 * always decided here.
 */

import { randomId } from "@chainmon/game-engine";
import { getCaptureBall, calculateCaptureChance } from "@chainmon/game-engine";
import { getSpeciesById } from "@chainmon/monster-data";
import { generateEncounter, type WildEncounter } from "@chainmon/game-engine";
import { getRegionById } from "@chainmon/monster-data";
import type { GameRepository, WorldSpawnRecord } from "@/lib/data";
import {
  WORLD_MAX_SPAWNS,
  WORLD_MIN_SPAWNS,
  WORLD_SPAWN_TTL_MS,
  DAILY_SUPPLY_COOLDOWN_MS,
  PICKUP_COOLDOWN_MS,
  WORLD_INTERACTION_DISTANCE_TILES,
} from "@/lib/world/world-config";
import { pickSpawnEntry, spawnLevel } from "@/lib/world/spawn-tables";
import type { ZoneId } from "@/lib/world/world-types";
import { WORLD_ZONES, zoneAt } from "@/lib/world/zones";
import { buildChainMonValley, BLOCKED_TILES } from "@/lib/world/map-data";

export class WorldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorldError";
  }
}

/** Zone → legacy region id used by the existing Encounter generation. */
const ZONE_TO_REGION: Partial<Record<ZoneId, string>> = {
  forest: "forest",
  lake: "lake",
  volcano: "volcano",
  "power-zone": "power-plant",
};

/** Deterministic random source for server spawn decisions. */
function serverRandom(): () => number {
  return () => Math.random();
}

/**
 * Reconcile world spawns (lazy, on /api/world/state):
 *  - delete expired spawns
 *  - top up to WORLD_MAX_SPAWNS with zone-weighted spawns
 * Spawns land on walkable tiles inside their zone.
 */
export async function reconcileWorldSpawns(
  repository: GameRepository,
): Promise<WorldSpawnRecord[]> {
  const now = new Date();
  await repository.deleteExpiredWorldSpawns(now);
  const existing = await repository.getWorldSpawns();
  const next = serverRandom();
  const map = buildChainMonValley();

  const toCreate: WorldSpawnRecord[] = [];
  const need = Math.max(0, WORLD_MAX_SPAWNS - existing.length);
  // also top-up if below the minimum
  const topUp = Math.max(need, WORLD_MIN_SPAWNS - existing.length);

  // We create spawns in random zones; the vault is gated to be rare.
  const zoneCandidates: ZoneId[] = [
    "forest",
    "lake",
    "volcano",
    "power-zone",
    "grove",
  ];
  // VaultTurtle zone appears rarely (cold vault hidden area, ~1-2%).
  if (next() < 0.12) zoneCandidates.push("vault");

  for (let i = 0; i < topUp; i++) {
    const zoneId = zoneCandidates[Math.floor(next() * zoneCandidates.length)]!;
    const entry = pickSpawnEntry(zoneId, next);
    if (!entry) continue;
    const zone = WORLD_ZONES.find((z) => z.id === zoneId)!;
    // pick a walkable tile inside the zone
    let x = 0;
    let y = 0;
    let attempts = 0;
    do {
      x = zone.x + 1 + Math.floor(next() * (zone.width - 2));
      y = zone.y + 1 + Math.floor(next() * (zone.height - 2));
      attempts += 1;
    } while (
      attempts < 24 &&
      (x >= map.cols || y >= map.rows || BLOCKED_TILES.has(map.tiles[y * map.cols + x]!))
    );
    const expiresAt = new Date(now.getTime() + WORLD_SPAWN_TTL_MS);
    toCreate.push({
      id: `spawn-${randomId()}`,
      speciesId: entry.speciesId,
      zoneId,
      x,
      y,
      level: spawnLevel(entry, next),
      createdAt: now,
      expiresAt,
    });
  }

  await repository.saveWorldSpawns(toCreate, WORLD_MAX_SPAWNS);
  return repository.getWorldSpawns();
}

/** Keep server-authoritative interactions close to the saved player tile. */
export function isWithinWorldInteractionDistance(
  position: { worldX: number; worldY: number },
  target: { x: number; y: number },
): boolean {
  return Math.hypot(position.worldX - target.x, position.worldY - target.y)
    <= WORLD_INTERACTION_DISTANCE_TILES;
}

export interface StartWorldEncounterParams {
  trainerId: string;
  spawnId: string;
}

export interface StartWorldEncounterResult {
  encounterId: string;
  speciesId: number;
  speciesName: string;
  element: string;
  rarity: string;
  level: number;
  currentHp: number;
  maxHp: number;
  catchChancePreview: number;
}

/**
 * Start an encounter from a world spawn. The species comes from the spawn
 * record — the client only ever submits the spawnId.
 */
export async function startWorldEncounter(
  repository: GameRepository,
  params: StartWorldEncounterParams,
): Promise<StartWorldEncounterResult> {
  const spawns = await repository.getWorldSpawns();
  const spawn = spawns.find((s) => s.id === params.spawnId);
  if (!spawn) {
    throw new WorldError("That wild monster is gone.");
  }
  if (spawn.expiresAt <= new Date()) {
    await repository.deleteWorldSpawn(spawn.id);
    throw new WorldError("That wild monster has left.");
  }

  const position = await repository.getTrainerWorldPosition(params.trainerId);
  if (!position || !isWithinWorldInteractionDistance(position, spawn)) {
    throw new WorldError("Move closer to that wild ChainMon.");
  }

  const species = getSpeciesById(spawn.speciesId);
  if (!species) {
    throw new WorldError("Unknown species.");
  }

  // Existing ACTIVE encounter? Return it (one encounter at a time).
  const active = await repository.getActiveEncounter(params.trainerId);
  if (active) {
    const activeSpecies = getSpeciesById(active.speciesId);
    if (!activeSpecies) {
      throw new WorldError("Unknown active encounter species.");
    }
    return {
      encounterId: active.id,
      speciesId: active.speciesId,
      speciesName: active.speciesName,
      element: activeSpecies.element,
      rarity: activeSpecies.rarity,
      level: active.level ?? 1,
      currentHp: active.currentHp,
      maxHp: active.maxHp,
      catchChancePreview: calculateCaptureChance({
        catchRate: activeSpecies.catchRate,
        currentHp: active.currentHp,
        maxHp: active.maxHp,
        ballModifier: 1.0,
      }),
    };
  }

  // Reuse the existing encounter generator with the spawn's species:
  // build an encounter record manually (same shape WildEncounter).
  const region = getRegionById(ZONE_TO_REGION[spawn.zoneId as ZoneId] ?? "forest");
  const encounter: WildEncounter = generateEncounter(
    region ?? getRegionById("forest")!,
    params.trainerId,
  );
  // Override species + level to match the spawn (server authority).
  // maxHp scales with level: base HP + (level-1) × 2 (simple world scaling).
  const scaledMaxHp = Math.max(
    species.baseHp,
    species.baseHp + (spawn.level - 1) * 2,
  );
  const forced: WildEncounter = {
    ...encounter,
    id: `enc-${randomId()}`,
    speciesId: spawn.speciesId,
    speciesName: species.name,
    element: species.element,
    rarity: species.rarity,
    level: spawn.level,
    currentHp: scaledMaxHp,
    maxHp: scaledMaxHp,
  };
  await repository.createEncounter(forced);

  // Remove the spawn from the map (it was engaged).
  await repository.deleteWorldSpawn(spawn.id);

  return {
    encounterId: forced.id,
    speciesId: forced.speciesId,
    speciesName: species.name,
    element: species.element,
    rarity: species.rarity,
    level: forced.level ?? 1,
    currentHp: forced.currentHp,
    maxHp: forced.maxHp,
    catchChancePreview: calculateCaptureChance({
      catchRate: species.catchRate,
      currentHp: forced.currentHp,
      maxHp: forced.maxHp,
      ballModifier: 1.0,
    }),
  };
}

/** Pickup definitions (kind → reward). */
export interface PickupReward {
  itemSlug?: string;
  gold?: number;
  quantity: number;
}

export const PICKUP_REWARDS: Record<string, PickupReward> = {
  "forest-spark-1": { itemSlug: "basic-ball", quantity: 2 },
  "lake-spark-1": { itemSlug: "great-ball", quantity: 1 },
  "volcano-spark-1": { gold: 60, quantity: 1 },
  "power-spark-1": { itemSlug: "basic-ball", quantity: 3 },
  "grove-spark-1": { itemSlug: "great-ball", quantity: 1 },
  "vault-chest-1": { itemSlug: "ultra-ball", quantity: 1 },
};

export function getPickupReward(pickupKey: string) {
  return PICKUP_REWARDS[pickupKey] ?? null;
}

export function validateWorldPosition(input: unknown, max: number): number | null {
  if (typeof input !== "number" || !Number.isFinite(input)) return null;
  return Math.max(0, Math.min(max, Math.floor(input)));
}

/** Daily supply bundle. */
export const DAILY_SUPPLY_ITEMS = [
  { itemSlug: "basic-ball", quantity: 5 },
  { itemSlug: "great-ball", quantity: 1 },
];

export { DAILY_SUPPLY_COOLDOWN_MS, PICKUP_COOLDOWN_MS, getCaptureBall, zoneAt };
