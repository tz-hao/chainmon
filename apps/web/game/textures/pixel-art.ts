/**
 * ChainMon Pixel World — runtime pixel-art texture generator (Phaser side).
 * Draws recognizable 8-16 color pixel monsters directly into Phaser
 * textures (no external files required). When real PNG assets exist under
 * public/game/monsters/..., scenes prefer them (see monster-visuals.ts).
 *
 * This is the MVP visual layer: distinct silhouettes per species, hard
 * edges, nearest-neighbor scaling.
 */

import type Phaser from "phaser";
import { paletteForSpecies, shapeForSpecies } from "../../lib/world/monster-visuals";

type Ctx = CanvasRenderingContext2D;

function px(ctx: Ctx, x: number, y: number, color: string, size = 2): void {
  ctx.fillStyle = color;
  ctx.fillRect(x * size, y * size, size, size);
}

/** Silhouette templates drawn on a 16×16 grid (2px cells → 32×32 texture). */
function drawShape(ctx: Ctx, shape: string, p: ReturnType<typeof paletteForSpecies>): void {
  const O = p.outline;
  const B = p.body;
  const D = p.bodyDark;
  const A = p.accent;
  const E = p.eye;

  const body: [number, number][] = [];
  const dark: [number, number][] = [];
  const accent: [number, number][] = [];
  let eyes: [number, number][] = [];

  switch (shape) {
    case "cub": // small flame cub — round body, flame tail, ears
      body.push([4, 8], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10]);
      dark.push([5, 8], [9, 8]);
      accent.push([11, 8], [12, 9], [11, 10]);
      eyes = [[6, 8], [9, 8]];
      break;
    case "wolf": // flame wolf — snout, mane
      body.push([3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [2, 8], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8], [3, 9], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9]);
      dark.push([2, 8], [11, 8]);
      accent.push([12, 7], [13, 8], [12, 9]);
      eyes = [[4, 7], [8, 7]];
      break;
    case "wolf-large": // inferno — larger, blaze mane
      body.push([2, 6], [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7], [12, 7], [2, 8], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8], [3, 9], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9]);
      accent.push([13, 6], [14, 7], [13, 8], [1, 6], [0, 7]);
      dark.push([2, 7], [11, 7]);
      eyes = [[4, 7], [9, 7]];
      break;
    case "fox": // ember fox — bushy tail
      body.push([4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9]);
      accent.push([11, 6], [12, 6], [12, 7], [13, 7]);
      eyes = [[5, 7], [8, 7]];
      break;
    case "boar": // magma boar — tusks
      body.push([4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [3, 10], [11, 10]);
      accent.push([3, 8], [11, 8]);
      eyes = [[5, 7], [9, 7]];
      break;
    case "turtle": // aqua turtle — shell
      body.push([4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10]);
      dark.push([5, 8], [6, 8], [7, 8], [8, 8], [9, 8]);
      accent.push([6, 8]);
      eyes = [[4, 7], [10, 7]];
      break;
    case "fin": // bubble fin — fish
      body.push([4, 8], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [5, 10]);
      accent.push([2, 8], [2, 9], [12, 7]);
      eyes = [[6, 7], [8, 7]];
      break;
    case "otter": // tide otter — long body
      body.push([3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [5, 10], [6, 10], [7, 10], [8, 10]);
      dark.push([9, 8]);
      accent.push([11, 8]);
      eyes = [[4, 8], [6, 8]];
      break;
    case "serpent": // coral serpent — coil
      body.push([5, 6], [6, 6], [7, 6], [7, 7], [7, 8], [6, 8], [5, 8], [4, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [9, 10], [10, 10]);
      accent.push([5, 6], [9, 9]);
      eyes = [[7, 6]];
      break;
    case "shark": // abyss shark — fin + teeth
      body.push([3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [6, 10]);
      dark.push([3, 8]);
      accent.push([7, 5]);
      eyes = [[4, 8], [8, 8]];
      break;
    case "cat": // leaf cat — ears + leaf tail
      body.push([4, 8], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10]);
      accent.push([4, 6], [10, 6], [11, 10]);
      eyes = [[5, 8], [9, 8]];
      break;
    case "mantis": // bloom mantis — scythe arms
      body.push([6, 6], [6, 7], [5, 8], [6, 8], [7, 8], [6, 9], [5, 10], [6, 10], [7, 10], [6, 11]);
      accent.push([4, 7], [4, 8], [8, 7], [8, 8]);
      eyes = [[5, 6], [7, 6]];
      break;
    case "bear": // moss bear — bulky
      body.push([3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [3, 9], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [4, 10], [5, 10], [8, 10], [9, 10]);
      dark.push([3, 8], [10, 8]);
      accent.push([6, 9]);
      eyes = [[5, 7], [8, 7]];
      break;
    case "deer": // thorn deer — antlers
      body.push([5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [4, 10], [10, 10]);
      accent.push([4, 5], [5, 5], [9, 5], [10, 5]);
      eyes = [[6, 7], [8, 7]];
      break;
    case "treant": // ancient treant — trunk + canopy
      body.push([6, 6], [7, 6], [5, 7], [6, 7], [7, 7], [8, 7], [5, 8], [6, 8], [7, 8], [8, 8], [5, 9], [6, 9], [7, 9], [8, 9], [6, 10], [7, 10], [6, 11], [7, 11]);
      dark.push([6, 8], [7, 8]);
      accent.push([4, 7], [9, 7], [4, 9], [9, 9]);
      eyes = [[6, 7], [7, 7]];
      break;
    case "mouse": // spark mouse — round + tail
      body.push([5, 8], [6, 7], [7, 7], [8, 7], [9, 7], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [6, 10], [7, 10], [8, 10]);
      accent.push([4, 7], [10, 10]);
      eyes = [[6, 8], [9, 8]];
      break;
    case "lynx": // static lynx — tufted ears
      body.push([4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9]);
      accent.push([4, 5], [10, 5]);
      eyes = [[5, 7], [8, 7]];
      break;
    case "dragon": // storm dragon — wings
      body.push([4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [5, 10], [8, 10]);
      accent.push([2, 5], [3, 5], [11, 5], [12, 5], [2, 6], [12, 6]);
      eyes = [[5, 7], [9, 7]];
      break;
    case "hare": // volt hare — long ears
      body.push([5, 8], [6, 7], [7, 7], [8, 7], [9, 7], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [6, 10], [7, 10], [8, 10]);
      accent.push([5, 5], [6, 5], [8, 5], [9, 5]);
      eyes = [[6, 8], [9, 8]];
      break;
    case "bird": // thunder bird — wings spread
      body.push([6, 7], [7, 7], [8, 7], [6, 8], [7, 8], [8, 8], [6, 9], [7, 9], [8, 9], [7, 10]);
      accent.push([3, 6], [4, 6], [10, 6], [11, 6], [3, 7], [11, 7]);
      eyes = [[6, 7], [8, 7]];
      break;
    case "unicorn": // swapicorn — horn + orbs
      body.push([4, 8], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10]);
      accent.push([7, 5], [7, 6], [2, 6], [12, 6], [2, 12], [12, 12]);
      eyes = [[5, 8], [9, 8]];
      break;
    case "owl": // oracle owl — round eyes
      body.push([5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [6, 9], [7, 9], [8, 9]);
      accent.push([5, 5], [9, 5]);
      eyes = [[6, 6], [8, 6]];
      break;
    case "bat": // zk bat — wings up
      body.push([6, 7], [7, 7], [8, 7], [6, 8], [7, 8], [8, 8], [6, 9], [7, 9], [8, 9]);
      accent.push([3, 6], [4, 6], [10, 6], [11, 6], [3, 7], [11, 7], [4, 11], [10, 11]);
      eyes = [[6, 7], [8, 7]];
      break;
    case "fox-two-tail": // bridge fox — two tails
      body.push([4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9]);
      accent.push([11, 5], [12, 5], [12, 6], [11, 9], [12, 9], [12, 10]);
      eyes = [[5, 7], [8, 7]];
      break;
    case "ghost": // lendgeist — floating ghost
      body.push([5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [5, 10], [7, 10], [9, 10]);
      accent.push([3, 7], [11, 7]);
      eyes = [[6, 6], [8, 6]];
      break;
    case "goblin": // gas goblin — backpack
      body.push([5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [6, 10], [7, 10]);
      dark.push([10, 7], [10, 8], [10, 9]);
      accent.push([11, 7]);
      eyes = [[6, 7], [8, 7]];
      break;
    case "mantis-mech": // mev mantis — blade arms
      body.push([6, 6], [6, 7], [5, 8], [6, 8], [7, 8], [6, 9], [5, 10], [6, 10], [7, 10], [6, 11]);
      accent.push([3, 7], [4, 7], [8, 7], [9, 7], [3, 8], [9, 8]);
      eyes = [[5, 6], [7, 6]];
      break;
    case "turtle-vault": // vault turtle — vault shell + display
      body.push([3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [4, 10], [5, 10], [9, 10], [10, 10]);
      dark.push([5, 8], [6, 8], [7, 8], [8, 8], [9, 8]);
      accent.push([6, 8], [8, 8]);
      eyes = [[4, 7], [10, 7]];
      break;
    default:
      body.push([5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [6, 9], [7, 9]);
      eyes = [[6, 7], [8, 7]];
  }

  // outline pass (draw a 1-cell ring around the body)
  const outlineSet = new Set<string>();
  for (const [x, y] of body) {
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      outlineSet.add(`${x + ox},${y + oy}`);
    }
  }
  for (const [x, y] of body) outlineSet.delete(`${x},${y}`);
  for (const key of outlineSet) {
    const [x, y] = key.split(",").map(Number) as [number, number];
    px(ctx, x, y, O);
  }
  for (const [x, y] of body) px(ctx, x, y, B);
  for (const [x, y] of dark) px(ctx, x, y, D);
  for (const [x, y] of accent) px(ctx, x, y, A);
  for (const [x, y] of eyes) px(ctx, x, y, E, 1);
}

/** Generate (or reuse) a 32×32 monster texture for the given species. */
export function ensureMonsterTexture(
  scene: Phaser.Scene,
  speciesId: number,
  textureKey: string,
): string {
  if (scene.textures.exists(textureKey)) return textureKey;

  const palette = paletteForSpecies(speciesId);
  const shape = shapeForSpecies(speciesId);
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return textureKey;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 32, 32);
  drawShape(ctx, shape, palette);
  scene.textures.addCanvas(textureKey, canvas);
  return textureKey;
}

type TrainerDirection = "down" | "left" | "right" | "up";

function trainerBlock(
  ctx: Ctx,
  ox: number,
  oy: number,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(ox + x * 2, oy + y * 2, width * 2, height * 2);
}

/** Draw one 16×16 pixel Trainer frame into its 32×32 canvas cell. */
function drawTrainerFrame(
  ctx: Ctx,
  ox: number,
  oy: number,
  direction: TrainerDirection,
  walking: boolean,
): void {
  const outline = "#101828";
  const capDark = "#0f4c81";
  const cap = "#38bdf8";
  const capBadge = "#facc15";
  const hair = "#5b341d";
  const skin = "#f1c39b";
  const skinShade = "#d99d76";
  const jacketDark = "#1d4f91";
  const jacket = "#3b82f6";
  const scarf = "#f97316";
  const pack = "#5b3d21";
  const trousers = "#253a61";
  const shoe = "#182235";
  const highlight = "#e0f2fe";
  const side = direction === "left" ? -1 : direction === "right" ? 1 : 0;
  const front = direction === "down";
  const back = direction === "up";
  const stride = walking ? 1 : 0;

  // Hat, hair and head: the strong outline keeps the tiny silhouette readable.
  trainerBlock(ctx, ox, oy, 3, 1, 10, 1, outline);
  trainerBlock(ctx, ox, oy, 2, 2, 12, 3, outline);
  trainerBlock(ctx, ox, oy, 3, 1, 10, 2, capDark);
  trainerBlock(ctx, ox, oy, 3, 2, 9, 2, cap);
  trainerBlock(ctx, ox, oy, 7, 2, 2, 1, capBadge);
  if (front) trainerBlock(ctx, ox, oy, 2, 4, 12, 1, capDark);
  if (back) trainerBlock(ctx, ox, oy, 3, 4, 10, 1, capDark);
  if (side !== 0) trainerBlock(ctx, ox, oy, side < 0 ? 1 : 12, 3, 2, 1, capDark);
  trainerBlock(ctx, ox, oy, 3, 5, 10, 4, outline);
  trainerBlock(ctx, ox, oy, 4, 5, 8, 4, skin);
  if (back) {
    trainerBlock(ctx, ox, oy, 4, 5, 8, 3, hair);
    trainerBlock(ctx, ox, oy, 5, 8, 6, 1, hair);
  } else {
    trainerBlock(ctx, ox, oy, 4, 5, 2, 3, hair);
    trainerBlock(ctx, ox, oy, 10, 5, 2, 3, hair);
    if (front) {
      trainerBlock(ctx, ox, oy, 5, 6, 1, 1, outline);
      trainerBlock(ctx, ox, oy, 10, 6, 1, 1, outline);
      trainerBlock(ctx, ox, oy, 7, 8, 2, 1, skinShade);
    } else {
      trainerBlock(ctx, ox, oy, side < 0 ? 5 : 10, 6, 1, 1, outline);
      trainerBlock(ctx, ox, oy, side < 0 ? 3 : 12, 7, 1, 1, skinShade);
    }
  }

  // Jacket, scarf, backpack and arms distinguish the adventurer from an NPC.
  trainerBlock(ctx, ox, oy, 4, 9, 8, 1, outline);
  trainerBlock(ctx, ox, oy, 3, 10, 10, 4, outline);
  trainerBlock(ctx, ox, oy, 4, 10, 8, 4, jacketDark);
  trainerBlock(ctx, ox, oy, 5, 10, 6, 3, jacket);
  trainerBlock(ctx, ox, oy, 5, 10, 6, 1, scarf);
  if (back) {
    trainerBlock(ctx, ox, oy, 4, 10, 8, 3, pack);
    trainerBlock(ctx, ox, oy, 5, 11, 6, 1, jacketDark);
  }
  if (side !== 0) trainerBlock(ctx, ox, oy, side < 0 ? 3 : 11, 10, 1, 3, pack);
  const leftArmY = walking ? 11 + stride : 11;
  const rightArmY = walking ? 11 + (stride ? 0 : 1) : 11;
  trainerBlock(ctx, ox, oy, 2, leftArmY, 2, 3, outline);
  trainerBlock(ctx, ox, oy, 2, leftArmY, 1, 2, jacket);
  trainerBlock(ctx, ox, oy, 12, rightArmY, 2, 3, outline);
  trainerBlock(ctx, ox, oy, 13, rightArmY, 1, 2, jacket);
  trainerBlock(ctx, ox, oy, 2, leftArmY + 2, 1, 1, skin);
  trainerBlock(ctx, ox, oy, 13, rightArmY + 2, 1, 1, skin);

  // Alternating legs provide a clear two-frame walk cycle.
  trainerBlock(ctx, ox, oy, 4, 14, 4, 2, outline);
  trainerBlock(ctx, ox, oy, 8, 14, 4, 2, outline);
  trainerBlock(ctx, ox, oy, 5, 14, 2, 2, trousers);
  trainerBlock(ctx, ox, oy, 9, 14, 2, 2, trousers);
  trainerBlock(ctx, ox, oy, 4, walking ? 14 : 15, 4, 1, shoe);
  trainerBlock(ctx, ox, oy, 8, 15, 4, 1, shoe);
  if (front) trainerBlock(ctx, ox, oy, 5, 11, 1, 1, highlight);
}

/**
 * Generate the player sprite textures: 4 directions × 2 frames (32×32 each).
 * Keys: player-<dir>-<frame>, animations: player-anim-<dir>.
 */
export function ensurePlayerTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists("player-down-0")) return;
  const canvas = document.createElement("canvas");
  canvas.width = 32 * 2; // 2 frames
  canvas.height = 32 * 4; // 4 directions
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const dirs: TrainerDirection[] = ["down", "left", "right", "up"];
  dirs.forEach((dir, row) => {
    for (let col = 0; col < 2; col++) {
      drawTrainerFrame(ctx, col * 32, row * 32, dir, col === 1);
    }
  });

  dirs.forEach((dir, row) => {
    for (let col = 0; col < 2; col++) {
      const key = `player-${dir}-${col}`;
      const frameCanvas = document.createElement("canvas");
      frameCanvas.width = 32;
      frameCanvas.height = 32;
      const fctx = frameCanvas.getContext("2d");
      if (!fctx) return;
      fctx.imageSmoothingEnabled = false;
      fctx.drawImage(canvas, col * 32, row * 32, 32, 32, 0, 0, 32, 32);
      scene.textures.addCanvas(key, frameCanvas);
    }
    scene.anims.create({
      key: `player-anim-${dir}`,
      frames: [
        { key: `player-${dir}-0` },
        { key: `player-${dir}-1` },
      ],
      frameRate: 8,
      repeat: -1,
    });
  });
}
