/** Phaser-side texture generation for the trainer only. */

import type Phaser from "phaser";

type Ctx = CanvasRenderingContext2D;
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

  trainerBlock(ctx, ox, oy, 4, 14, 4, 2, outline);
  trainerBlock(ctx, ox, oy, 8, 14, 4, 2, outline);
  trainerBlock(ctx, ox, oy, 5, 14, 2, 2, trousers);
  trainerBlock(ctx, ox, oy, 9, 14, 2, 2, trousers);
  trainerBlock(ctx, ox, oy, 4, walking ? 14 : 15, 4, 1, shoe);
  trainerBlock(ctx, ox, oy, 8, 15, 4, 1, shoe);
  if (front) trainerBlock(ctx, ox, oy, 5, 11, 1, 1, highlight);
}

/** Generate the player sprite textures: 4 directions × 2 frames (32×32 each). */
export function ensurePlayerTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists("player-down-0")) return;
  const canvas = document.createElement("canvas");
  canvas.width = 32 * 2;
  canvas.height = 32 * 4;
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
      frames: [{ key: `player-${dir}-0` }, { key: `player-${dir}-1` }],
      frameRate: 8,
      repeat: -1,
    });
  });
}
