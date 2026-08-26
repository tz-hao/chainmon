/**
 * ChainMon Pixel World — shared world types (Phase: Pixel World Upgrade).
 * Client-safe data structures used by Phaser scenes and React overlays.
 */

export type ZoneId =
  | "camp"
  | "forest"
  | "lake"
  | "volcano"
  | "power-zone"
  | "grove"
  | "vault";

export interface WorldZone {
  id: ZoneId;
  name: string;
  /** tile-space rectangle of the zone */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorldSpawnData {
  spawnId: string;
  speciesId: number;
  zoneId: string;
  x: number;
  y: number;
  level: number;
  expiresAt: string;
}

export interface WorldStateResponse {
  trainer: {
    id: string;
    nickname: string;
    gold: number;
    worldMap: string;
    worldX: number;
    worldY: number;
    zoneId: string | null;
  };
  spawns: WorldSpawnData[];
  pickups: WorldPickupData[];
  dailySupply: {
    ready: boolean;
    nextAt: string | null;
  };
  inventory: {
    slug: string;
    quantity: number;
  }[];
}

export interface WorldPickupData {
  pickupKey: string;
  kind: "blue-spark" | "purple-spark" | "gold-chest";
  x: number;
  y: number;
  available: boolean;
  nextAt: string | null;
}

export interface EncounterStartResponse {
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

export interface ShopPurchaseResponse {
  ok: boolean;
  goldAfter: number;
  inventory: { slug: string; quantity: number }[];
  error?: string;
}

export interface PickupClaimResponse {
  ok: boolean;
  reward?: { itemSlug: string; quantity: number } | { gold: number };
  nextAt?: string | null;
  error?: string;
}

export interface DailySupplyResponse {
  ok: boolean;
  items?: { itemSlug: string; quantity: number }[];
  nextAt?: string | null;
  error?: string;
}
