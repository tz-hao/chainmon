import { beforeEach, describe, expect, it } from "vitest";
import { getSpeciesById } from "@chainmon/monster-data";
import { createTrainerWithStarter } from "../../data/demo-service";
import { memoryRepository, resetMemoryRepository } from "../../data/memory-repository";
import { exploreRegion } from "../../services/explore-service";
import {
  BLOCKED_TILES,
  buildChainMonValley,
  validateMap,
} from "../map-data";
import { WORLD_ZONES, zoneAt, zoneNameAt } from "../zones";
import {
  SPAWN_TABLES,
  pickSpawnEntry,
  spawnLevel,
} from "../spawn-tables";
import {
  WORLD_COLS,
  WORLD_MAX_SPAWNS,
  WORLD_MIN_SPAWNS,
  WORLD_ROWS,
} from "../world-config";
import { isBlockedCode, pixelsToTile, resolveMovement, tileToPixels } from "../player-controller";
import {
  isWithinWorldInteractionDistance,
  startWorldEncounter,
  validateWorldPosition,
} from "../../services/world-service";

describe("ChainMon Valley map", () => {
  it("has valid dimensions (64×48) and no zone overflow", () => {
    const map = buildChainMonValley();
    expect(validateMap(map)).toEqual([]);
    expect(map.cols).toBe(WORLD_COLS);
    expect(map.rows).toBe(WORLD_ROWS);
  });

  it("contains all required zones", () => {
    const ids = WORLD_ZONES.map((z) => z.id);
    for (const required of ["camp", "forest", "lake", "volcano", "power-zone", "grove", "vault"]) {
      expect(ids).toContain(required);
    }
    expect(WORLD_ZONES.length).toBeGreaterThanOrEqual(7);
  });

  it("places the shop and tutorial NPCs inside the camp", () => {
    const map = buildChainMonValley();
    const camp = WORLD_ZONES.find((z) => z.id === "camp")!;
    for (const npc of [map.shopNpc, map.guideNpc]) {
      expect(npc.x).toBeGreaterThanOrEqual(camp.x);
      expect(npc.x).toBeLessThan(camp.x + camp.width);
      expect(npc.y).toBeGreaterThanOrEqual(camp.y);
      expect(npc.y).toBeLessThan(camp.y + camp.height);
    }
  });

  it("places 5-8 pickups inside their zones", () => {
    const map = buildChainMonValley();
    expect(map.pickups.length).toBeGreaterThanOrEqual(5);
    expect(map.pickups.length).toBeLessThanOrEqual(8);
    for (const p of map.pickups) {
      const zone = zoneAt(p.x, p.y);
      expect(zone, `pickup ${p.pickupKey} at ${p.x},${p.y} should be in a zone`).toBeDefined();
    }
  });

  it("zone lookup works", () => {
    expect(zoneNameAt(30, 24)).toBe("Trainer Camp");
    expect(zoneNameAt(5, 10)).toBe("Whispering Forest");
    expect(zoneAt(60, 60)).toBeUndefined();
  });

  it("water and trees are blocked", () => {
    expect(BLOCKED_TILES.has("w")).toBe(true);
    expect(BLOCKED_TILES.has("t")).toBe(true);
    expect(BLOCKED_TILES.has("v")).toBe(true);
    expect(BLOCKED_TILES.has(".")).toBe(false);
  });
});

describe("spawn tables", () => {
  it("every zone table has positive weights and valid levels", () => {
    for (const [zone, table] of Object.entries(SPAWN_TABLES)) {
      expect(zone).toBeTruthy();
      for (const entry of table) {
        expect(entry.weight).toBeGreaterThan(0);
        expect(entry.levelMin).toBeGreaterThanOrEqual(1);
        expect(entry.levelMax).toBeGreaterThanOrEqual(entry.levelMin);
      }
    }
  });

  it("legendaries spawn rarely and only in their zones", () => {
    // AbyssShark (10), AncientTreant (15), VaultTurtle (28)
    for (const [zone, table] of Object.entries(SPAWN_TABLES)) {
      for (const entry of table) {
        if ([10, 15, 28].includes(entry.speciesId)) {
          // VaultTurtle lives in a single-species zone (relative weight 2);
          // the other legendaries share big tables with weight ≤2.
          if (zone !== "vault") {
            expect(entry.weight).toBeLessThanOrEqual(2);
          }
          expect(["lake", "forest", "vault"]).toContain(zone);
        }
      }
    }
    const vault = SPAWN_TABLES.vault;
    expect(vault.map((e) => e.speciesId)).toEqual([28]); // VaultTurtle only
  });

  it("VaultTurtle is vault-only with ~1-2% overall presence", () => {
    // The vault is only added as a spawn candidate 12% of reconciles
    // (world-service), and it is the only zone containing VaultTurtle.
    // Its zone weight (2) vs the total zone weights (≈536) keeps the
    // absolute presence far below common spawns.
    const vaultWeight = SPAWN_TABLES.vault.reduce((s, e) => s + e.weight, 0);
    const totalWeight = Object.values(SPAWN_TABLES).reduce(
      (sum, table) => sum + table.reduce((s, e) => s + e.weight, 0),
      0,
    );
    const zoneShare = vaultWeight / totalWeight;
    expect(zoneShare).toBeGreaterThan(0.001);
    expect(zoneShare).toBeLessThan(0.01); // ~0.37% of all spawn rolls
    expect(SPAWN_TABLES.vault[0]!.speciesId).toBe(28);
  });

  it("Web3 monsters spawn in their zones (Swapicorn / GasGoblin / ZkBat)", () => {
    const grove = SPAWN_TABLES.grove.map((e) => e.speciesId);
    const volcano = SPAWN_TABLES.volcano.map((e) => e.speciesId);
    const power = SPAWN_TABLES["power-zone"].map((e) => e.speciesId);
    expect(grove).toContain(21); // Swapicorn
    expect(volcano).toContain(26); // GasGoblin
    expect(power).toContain(23); // ZkBat
  });

  it("pickSpawnEntry is deterministic with an injected source", () => {
    const entry = pickSpawnEntry("forest", () => 0);
    expect(entry?.speciesId).toBe(11); // first weighted entry (LeafCat)
    expect(spawnLevel(entry!, () => 0)).toBe(entry!.levelMin);
    expect(pickSpawnEntry("camp", () => 0)).toBeNull();
  });
});

describe("player controller (pure movement)", () => {
  it("moves right with D", () => {
    const next = resolveMovement(
      { up: false, down: false, left: false, right: true },
      100,
      100,
      100,
      1000,
    );
    expect(next.x).toBeGreaterThan(100);
    expect(next.y).toBe(100);
    expect(next.moving).toBe(true);
  });

  it("diagonal movement is normalized", () => {
    const next = resolveMovement(
      { up: true, down: false, left: false, right: true },
      0,
      0,
      100,
      1000,
    );
    const dist = Math.hypot(next.x, next.y);
    expect(dist).toBeCloseTo(100, 5);
  });

  it("idle keeps position", () => {
    const next = resolveMovement(
      { up: false, down: false, left: false, right: false },
      50,
      60,
      100,
      1000,
    );
    expect(next).toMatchObject({ x: 50, y: 60, moving: false });
  });

  it("pixel ↔ tile conversion round-trips", () => {
    const t = { x: 12, y: 7 };
    const p = tileToPixels(t.x, t.y);
    expect(pixelsToTile(p.x, p.y)).toEqual(t);
  });

  it("blocked codes match the map's blocked set", () => {
    for (const code of ["w", "t", "r", "#", "v", "n", "s"]) {
      expect(isBlockedCode(code)).toBe(true);
    }
    expect(isBlockedCode(".")).toBe(false);
  });
});

describe("world config sanity", () => {
  it("spawn counts are sane (8-14 visible monsters)", () => {
    expect(WORLD_MIN_SPAWNS).toBeGreaterThanOrEqual(8);
    expect(WORLD_MAX_SPAWNS).toBeLessThanOrEqual(14);
    expect(WORLD_MAX_SPAWNS).toBeGreaterThanOrEqual(WORLD_MIN_SPAWNS);
  });

  it("requires server interactions to stay within the configured tile radius", () => {
    expect(isWithinWorldInteractionDistance({ worldX: 10, worldY: 10 }, { x: 12, y: 12 })).toBe(true);
    expect(isWithinWorldInteractionDistance({ worldX: 10, worldY: 10 }, { x: 14, y: 10 })).toBe(false);
  });

  it("accepts only finite numeric position input and clamps map bounds", () => {
    expect(validateWorldPosition(12.9, 63)).toBe(12);
    expect(validateWorldPosition(-4, 63)).toBe(0);
    expect(validateWorldPosition(999, 63)).toBe(63);
    expect(validateWorldPosition("12", 63)).toBeNull();
    expect(validateWorldPosition(Number.NaN, 63)).toBeNull();
  });
});

describe("world encounter response", () => {
  beforeEach(() => resetMemoryRepository());

  it("uses the existing ACTIVE encounter species for element and rarity", async () => {
    const { trainer } = await createTrainerWithStarter(memoryRepository, "Ash", "firecub");
    const active = await exploreRegion(memoryRepository, trainer.id, "forest");
    const activeSpecies = getSpeciesById(active.speciesId)!;

    await memoryRepository.saveWorldSpawns([
      {
        id: "other-spawn",
        speciesId: 18,
        zoneId: "volcano",
        x: 46,
        y: 33,
        level: 12,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      },
    ]);
    await memoryRepository.saveTrainerWorldPosition(trainer.id, {
      worldMap: "chainmon-valley",
      worldX: 46,
      worldY: 33,
    });

    const response = await startWorldEncounter(memoryRepository, {
      trainerId: trainer.id,
      spawnId: "other-spawn",
    });

    expect(response.encounterId).toBe(active.id);
    expect(response.speciesId).toBe(active.speciesId);
    expect(response.element).toBe(activeSpecies.element);
    expect(response.rarity).toBe(activeSpecies.rarity);
  });
});
