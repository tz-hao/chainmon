/**
 * ChainMon Pixel World — player controller (pure logic, testable).
 * Maps WASD + arrow keys to a direction vector. Phaser only feeds key
 * states in; movement math lives here.
 */

export type Facing = "down" | "left" | "right" | "up";

export interface MovementInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface PlayerState {
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
}

export function resolveMovement(
  input: MovementInput,
  x: number,
  y: number,
  speedPx: number,
  deltaMs: number,
): PlayerState {
  let dx = 0;
  let dy = 0;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;

  const moving = dx !== 0 || dy !== 0;
  const length = Math.hypot(dx, dy) || 1;
  const step = (speedPx * deltaMs) / 1000;
  const nx = x + (dx / length) * step;
  const ny = y + (dy / length) * step;

  const facing: Facing = moving
    ? Math.abs(dx) >= Math.abs(dy)
      ? dx > 0
        ? "right"
        : "left"
      : dy > 0
        ? "down"
        : "up"
    : (null as unknown as Facing);

  return {
    x: nx,
    y: ny,
    facing: moving ? facing : "down",
    moving,
  };
}

/** Normalize a tile-space position into a pixel center. */
export function tileToPixels(tileX: number, tileY: number, tileSize = 16): { x: number; y: number } {
  return { x: tileX * tileSize + tileSize / 2, y: tileY * tileSize + tileSize / 2 };
}

/** Tile coordinates for a pixel position. */
export function pixelsToTile(x: number, y: number, tileSize = 16): { x: number; y: number } {
  return { x: Math.floor(x / tileSize), y: Math.floor(y / tileSize) };
}

/** Is a tile walkable? (blocked codes are server-side too; this is a client mirror) */
export function isBlockedCode(code: string): boolean {
  return ["w", "t", "r", "#", "v", "n", "s"].includes(code);
}
