/**
 * ChainMon Pixel World — world configuration.
 * ChainMon Valley: a small 64×48 tile loop map, 16px tiles displayed at 3x.
 */

export const WORLD_TILE_SIZE = 16;
export const WORLD_TILE_SCALE = 3; // 16px → 48px on screen
export const WORLD_COLS = 64;
export const WORLD_ROWS = 48;
export const WORLD_WIDTH = WORLD_COLS * WORLD_TILE_SIZE; // 1024
export const WORLD_HEIGHT = WORLD_ROWS * WORLD_TILE_SIZE; // 768

/** Phaser render config (section 6 of the spec). */
export const WORLD_RENDER = {
  width: 960,
  height: 540,
  pixelArt: true,
  roundPixels: true,
  scaleMode: "FIT" as const,
  scaleCenter: "CENTER_BOTH" as const,
};

/** Player sprite: 32×32 source, rendered at 3x (96px on screen). */
export const PLAYER_SOURCE_SIZE = 32;
export const PLAYER_RENDER_SCALE = 3;
export const PLAYER_SPEED = 170; // px per second at source scale

/** Monster overworld: 32×32 source, rendered at 2.5x (80px). */
export const MONSTER_OVERWORLD_SCALE = 2.5;

/** Max visible wild monsters per world load. */
export const WORLD_MAX_SPAWNS = 12;
/** Minimum visible wild monsters before reconciliation refills. */
export const WORLD_MIN_SPAWNS = 8;
/** Normal spawn lifespan in ms. */
export const WORLD_SPAWN_TTL_MS = 8 * 60 * 1000;

/** Pickup cooldown in ms. */
export const PICKUP_COOLDOWN_MS = 10 * 60 * 1000;
/** Daily supply cooldown in ms. */
export const DAILY_SUPPLY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
/** Server-side interaction radius for wild spawns and static pickups. */
export const WORLD_INTERACTION_DISTANCE_TILES = 3;

/** Player position save throttle (ms). */
export const POSITION_SAVE_THROTTLE_MS = 4000;

export const WORLD_MAP_KEY = "chainmon-valley";

export const PLAYER_SPAWN = { x: 30, y: 24 };
