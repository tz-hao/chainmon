/**
 * ChainMon Pixel World — ChainMon Valley map data.
 * 64×48 tiles (16px each). Deterministic procedural construction so the map
 * stays maintainable; tile codes:
 *
 *   . grass (walkable)     g wild grass (walkable, grass encounter)
 *   w water (blocked)      t tree (blocked)        r rock (blocked)
 *   # wall (blocked)       v lava (blocked)
 *   p path (walkable)      c camp floor (walkable)
 *   n npc (blocked)        s shop npc (blocked)
 *   B ball pickup (walkable, interact)
 *
 * Zones (tile coords) must match zones.ts.
 */

import { WORLD_COLS, WORLD_ROWS } from "./world-config";
import { WORLD_ZONES } from "./zones";

export type TileCode =
  | "."
  | "g"
  | "w"
  | "t"
  | "r"
  | "#"
  | "v"
  | "p"
  | "c"
  | "n"
  | "s"
  | "B";

export const BLOCKED_TILES: ReadonlySet<TileCode> = new Set([
  "w",
  "t",
  "r",
  "#",
  "v",
  "n",
  "s",
]);

export const GRASS_TILES: ReadonlySet<TileCode> = new Set(["g"]);

export interface WorldMapData {
  cols: number;
  rows: number;
  /** row-major: tiles[row * cols + col] */
  tiles: TileCode[];
  /** tile coords of interactive pickups */
  pickups: { x: number; y: number; pickupKey: string }[];
  /** tile coords of the shop NPC */
  shopNpc: { x: number; y: number };
  /** tile coords of the tutorial NPC */
  guideNpc: { x: number; y: number };
}

export function buildChainMonValley(): WorldMapData {
  const cols = WORLD_COLS;
  const rows = WORLD_ROWS;
  const tiles: TileCode[] = new Array(cols * rows).fill(".");

  const set = (x: number, y: number, code: TileCode) => {
    if (x >= 0 && x < cols && y >= 0 && y < rows) tiles[y * cols + x] = code;
  };
  const at = (x: number, y: number): TileCode => tiles[y * cols + x]!;

  // --- Boundary walls ---
  for (let x = 0; x < cols; x++) {
    set(x, 0, "#");
    set(x, rows - 1, "#");
  }
  for (let y = 0; y < rows; y++) {
    set(0, y, "#");
    set(cols - 1, y, "#");
  }

  // --- Lake (bottom-left) ---
  const lakeZone = WORLD_ZONES.find((z) => z.id === "lake")!;
  for (let y = lakeZone.y + 2; y < lakeZone.y + lakeZone.height - 1; y++) {
    for (let x = lakeZone.x + 4; x < lakeZone.x + lakeZone.width - 2; x++) {
      if (x < cols - 1 && y < rows - 1) set(x, y, "w");
    }
  }

  // --- Volcano (bottom-right): lava pool ---
  const volZone = WORLD_ZONES.find((z) => z.id === "volcano")!;
  for (let y = volZone.y + 3; y < volZone.y + volZone.height - 1; y++) {
    for (let x = volZone.x + 5; x < volZone.x + volZone.width - 3; x++) {
      if (x < cols - 1 && y < rows - 1) set(x, y, "v");
    }
  }
  // Volcano rim rocks
  for (let x = volZone.x + 4; x < volZone.x + volZone.width - 2; x++) {
    set(x, volZone.y + 2, "r");
    set(x, volZone.y + volZone.height - 2, "r");
  }

  // --- Cold Vault (top, hidden): rocky cave entrance ---
  const vaultZone = WORLD_ZONES.find((z) => z.id === "vault")!;
  for (let y = vaultZone.y; y < vaultZone.y + vaultZone.height; y++) {
    for (let x = vaultZone.x; x < vaultZone.x + vaultZone.width; x++) {
      if (x < cols - 1 && y >= 1) set(x, y, "r");
    }
  }
  // Cave floor inside
  for (let y = vaultZone.y + 1; y < vaultZone.y + vaultZone.height - 1; y++) {
    for (let x = vaultZone.x + 2; x < vaultZone.x + vaultZone.width - 2; x++) {
      set(x, y, "p");
    }
  }
  // Cave entrance from the south
  set(vaultZone.x + 3, vaultZone.y + vaultZone.height - 1, "p");
  set(vaultZone.x + 4, vaultZone.y + vaultZone.height - 1, "p");

  // --- Forest trees (top-left) ---
  const forestZone = WORLD_ZONES.find((z) => z.id === "forest")!;
  const treeSpots: [number, number][] = [];
  for (let y = forestZone.y + 1; y < forestZone.y + forestZone.height - 1; y++) {
    for (let x = forestZone.x + 1; x < forestZone.x + forestZone.width - 1; x++) {
      if ((x * 7 + y * 13) % 5 === 0 && x > forestZone.x + 3) {
        set(x, y, "t");
        treeSpots.push([x, y]);
      } else if ((x + y) % 3 === 0 && x > forestZone.x + 2 && x < forestZone.x + forestZone.width - 2) {
        set(x, y, "g");
      }
    }
  }

  // --- Power zone sparks + grass (top-right) ---
  const powerZone = WORLD_ZONES.find((z) => z.id === "power-zone")!;
  for (let y = powerZone.y + 1; y < powerZone.y + powerZone.height - 1; y++) {
    for (let x = powerZone.x + 1; x < powerZone.x + powerZone.width - 1; x++) {
      if ((x * 3 + y * 5) % 7 === 0 && x > powerZone.x + 3) {
        set(x, y, "g");
      } else if ((x + y) % 11 === 0) {
        set(x, y, "r");
      }
    }
  }

  // --- Grove (left-middle): small pond + grass ---
  const groveZone = WORLD_ZONES.find((z) => z.id === "grove")!;
  for (let y = groveZone.y + 1; y < groveZone.y + groveZone.height - 1; y++) {
    for (let x = groveZone.x + 1; x < groveZone.x + groveZone.width - 1; x++) {
      if ((x + y) % 4 === 0 && x > groveZone.x + 2) set(x, y, "g");
    }
  }

  // --- Camp floor (center) ---
  const campZone = WORLD_ZONES.find((z) => z.id === "camp")!;
  for (let y = campZone.y; y < campZone.y + campZone.height; y++) {
    for (let x = campZone.x; x < campZone.x + campZone.width; x++) {
      if (x > 0 && x < cols - 1 && y > 0 && y < rows - 1) set(x, y, "c");
    }
  }
  // Camp borders (fence)
  for (let x = campZone.x; x < campZone.x + campZone.width; x++) {
    set(x, campZone.y, "r");
    set(x, campZone.y + campZone.height - 1, "r");
  }
  for (let y = campZone.y; y < campZone.y + campZone.height; y++) {
    set(campZone.x, y, "r");
    set(campZone.x + campZone.width - 1, y, "r");
  }
  // Camp gates (north/south/east/west openings)
  set(campZone.x + 5, campZone.y, "p");
  set(campZone.x + 5, campZone.y + campZone.height - 1, "p");
  set(campZone.x, campZone.y + 4, "p");
  set(campZone.x + campZone.width - 1, campZone.y + 4, "p");

  // --- Paths connecting zones (loop) ---
  // North path: camp → vault / forest / power zone
  for (let y = vaultZone.y + vaultZone.height; y < campZone.y; y++) {
    set(campZone.x + 5, y, "p");
  }
  // West path: camp → grove → lake
  for (let x = groveZone.x + groveZone.width; x < campZone.x; x++) {
    set(x, campZone.y + 4, "p");
  }
  for (let y = groveZone.y; y < campZone.y + 4; y++) {
    set(groveZone.x + groveZone.width - 2, y, "p");
  }
  // South path: camp → lake / volcano
  for (let y = campZone.y + campZone.height; y < lakeZone.y + lakeZone.height; y++) {
    set(campZone.x + 5, y, "p");
  }
  for (let y = campZone.y + campZone.height; y < volZone.y + volZone.height - 2; y++) {
    set(campZone.x + campZone.width - 6, y, "p");
  }
  // East path: camp → power zone
  for (let x = campZone.x + campZone.width; x < powerZone.x; x++) {
    set(x, campZone.y + 4, "p");
  }
  // Bottom horizontal path: lake → volcano
  for (let x = lakeZone.x + lakeZone.width - 1; x < volZone.x + 3; x++) {
    set(x, lakeZone.y + lakeZone.height - 3, "p");
  }
  // Top horizontal path: forest → power zone (through vault approach)
  for (let x = forestZone.x + forestZone.width - 2; x < powerZone.x + 2; x++) {
    set(x, campZone.y - 2, "p");
  }

  // --- NPCs (camp) ---
  const shopNpc = { x: campZone.x + 3, y: campZone.y + 2 };
  const guideNpc = { x: campZone.x + 8, y: campZone.y + 2 };
  set(shopNpc.x, shopNpc.y, "s");
  set(guideNpc.x, guideNpc.y, "n");

  // --- Pickups (5-8 glowing nodes) ---
  const pickupSpots: { x: number; y: number; pickupKey: string }[] = [
    { x: forestZone.x + 6, y: forestZone.y + 6, pickupKey: "forest-spark-1" },
    { x: lakeZone.x + 2, y: lakeZone.y + 5, pickupKey: "lake-spark-1" },
    { x: volZone.x + 2, y: volZone.y + 3, pickupKey: "volcano-spark-1" },
    { x: powerZone.x + 4, y: powerZone.y + 6, pickupKey: "power-spark-1" },
    { x: groveZone.x + 4, y: groveZone.y + 3, pickupKey: "grove-spark-1" },
    { x: vaultZone.x + 4, y: vaultZone.y + 2, pickupKey: "vault-chest-1" },
  ];
  for (const p of pickupSpots) {
    set(p.x, p.y, "B");
  }

  // Player spawn at the camp gate
  void at;

  return {
    cols,
    rows,
    tiles,
    pickups: pickupSpots,
    shopNpc,
    guideNpc,
  };
}

/** Validate the map: dimensions + no out-of-range zones. */
export function validateMap(map: WorldMapData): string[] {
  const problems: string[] = [];
  if (map.cols !== WORLD_COLS) problems.push(`cols ${map.cols} != ${WORLD_COLS}`);
  if (map.rows !== WORLD_ROWS) problems.push(`rows ${map.rows} != ${WORLD_ROWS}`);
  if (map.tiles.length !== WORLD_COLS * WORLD_ROWS) {
    problems.push(`tiles length ${map.tiles.length}`);
  }
  for (const z of WORLD_ZONES) {
    if (z.x + z.width > WORLD_COLS || z.y + z.height > WORLD_ROWS) {
      problems.push(`zone ${z.id} out of bounds`);
    }
  }
  return problems;
}
