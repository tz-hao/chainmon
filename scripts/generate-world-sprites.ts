/**
 * ChainMon Pixel World — programmatic sprite generator.
 *
 * Generates MVP pixel-art PNGs (transparent, hard edges, limited palette)
 * for all 28 monsters (overworld 32×32, battle-front 64×64, portrait
 * 128×128) plus capture-capsule icons, writing them to
 * apps/web/public/game/monsters/<id3>-<slug>/...
 *
 * These are PROGRAMMATIC MVP assets (recognizable silhouettes + palettes),
 * NOT final hand-drawn art. Drop-in replacement: overwrite the PNG files —
 * all UI resolves paths via lib/world/monster-visuals.ts.
 *
 * Run: npx tsx scripts/generate-world-sprites.ts
 */

import { deflateSync } from "zlib";
import { mkdirSync, writeFileSync } from "fs";
import * as path from "path";

// ---------- minimal PNG encoder (RGBA, no deps) ----------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- pixel canvas helper ----------

class PixelCanvas {
  readonly data: Buffer;
  constructor(readonly width: number, readonly height: number) {
    this.data = Buffer.alloc(width * height * 4); // transparent
  }
  px(x: number, y: number, hex: string): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const i = (y * this.width + x) * 4;
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
    this.data[i + 3] = 255;
  }
}

// ---------- palettes + shapes (mirrors lib/world/monster-visuals.ts) ----------

const PALETTES: Record<number, { body: string; dark: string; accent: string; accent2: string; eye: string; outline: string }> = {
  1: { body: "#e8633a", dark: "#a83a1e", accent: "#ffb347", accent2: "#ffd9a0", eye: "#1c1410", outline: "#571f0e" },
  2: { body: "#d9482b", dark: "#8f2c15", accent: "#ff8c42", accent2: "#ffca7a", eye: "#1a1008", outline: "#4a1a0c" },
  3: { body: "#c73e20", dark: "#7c2410", accent: "#ff9d00", accent2: "#ffe08a", eye: "#150d06", outline: "#3c1307" },
  4: { body: "#f0783c", dark: "#b34f1e", accent: "#ffd166", accent2: "#fff3c4", eye: "#221407", outline: "#5c2410" },
  5: { body: "#b0411e", dark: "#6f2410", accent: "#e06a2a", accent2: "#ffb066", eye: "#1c0f06", outline: "#3e1206" },
  6: { body: "#3aa8c1", dark: "#1e6a80", accent: "#7fd4e8", accent2: "#c9f2f7", eye: "#0d1c20", outline: "#0e3a47" },
  7: { body: "#4ab3d8", dark: "#256e8a", accent: "#8fe3f2", accent2: "#d8f8fb", eye: "#0c1d24", outline: "#123c4d" },
  8: { body: "#5bb8d4", dark: "#2c7490", accent: "#a3e6f5", accent2: "#e3fafc", eye: "#102028", outline: "#163e50" },
  9: { body: "#2e8fa8", dark: "#175469", accent: "#66c8dd", accent2: "#b8eef4", eye: "#081a20", outline: "#0b3544" },
  10: { body: "#264b62", dark: "#12283a", accent: "#4d8ba6", accent2: "#9cc8d8", eye: "#061218", outline: "#081a26" },
  11: { body: "#5fae3e", dark: "#37701f", accent: "#8fd465", accent2: "#d3f0b5", eye: "#12200a", outline: "#1c4010" },
  12: { body: "#6fbf4a", dark: "#3f7a26", accent: "#a3e070", accent2: "#e0f7c6", eye: "#14240c", outline: "#204514" },
  13: { body: "#4f8f3a", dark: "#2c551f", accent: "#7fbc60", accent2: "#c8e8b2", eye: "#101d0a", outline: "#1a3512" },
  14: { body: "#8a9a4a", dark: "#525e27", accent: "#b4c46e", accent2: "#e2ebbd", eye: "#141b08", outline: "#2e3514" },
  15: { body: "#3d6e2e", dark: "#1f3d16", accent: "#689f4d", accent2: "#aed89a", eye: "#0c1708", outline: "#14260d" },
  16: { body: "#f2d23a", dark: "#a8891a", accent: "#ffe96e", accent2: "#fff7c2", eye: "#1c1505", outline: "#58440a" },
  17: { body: "#e8c832", dark: "#9c8418", accent: "#fbe45e", accent2: "#fdf3b0", eye: "#191206", outline: "#4e3b08" },
  18: { body: "#2f6fd8", dark: "#17428c", accent: "#5b97f0", accent2: "#b7d4fb", eye: "#0a1528", outline: "#0c2450" },
  19: { body: "#f5e13c", dark: "#a69618", accent: "#ffef70", accent2: "#fff9c8", eye: "#1e1804", outline: "#5a4d06" },
  20: { body: "#3a7ee0", dark: "#1c4a94", accent: "#6aa5f2", accent2: "#c4dcfb", eye: "#0b162a", outline: "#0d2752" },
  21: { body: "#b48ae0", dark: "#6e4a96", accent: "#e3c8f5", accent2: "#f7ecfd", eye: "#1c1028", outline: "#3c2654" },
  22: { body: "#2c4a7c", dark: "#162a4a", accent: "#d4a12a", accent2: "#f2dc9c", eye: "#f2dc9c", outline: "#0c1a30" },
  23: { body: "#3c2a5e", dark: "#1f1434", accent: "#2ee0d0", accent2: "#a8f5ec", eye: "#2ee0d0", outline: "#100a1e" },
  24: { body: "#e8822a", dark: "#9c5012", accent: "#f0b04a", accent2: "#f8dcae", eye: "#201207", outline: "#54290a" },
  25: { body: "#5aa7e8", dark: "#2e6296", accent: "#a8d6f8", accent2: "#e3f4fe", eye: "#101c28", outline: "#173450" },
  26: { body: "#8fae3a", dark: "#546a1c", accent: "#c6e060", accent2: "#e9f6b0", eye: "#161f08", outline: "#2c3a10" },
  27: { body: "#4f9e3c", dark: "#2a5c1e", accent: "#82cc5c", accent2: "#c8efaa", eye: "#101f0a", outline: "#18340f" },
  28: { body: "#3e5f78", dark: "#22384a", accent: "#7fa8c2", accent2: "#c4dce8", eye: "#0c141c", outline: "#12202c" },
};

const SHAPES = [
  "cub", "wolf", "wolf-large", "fox", "boar",
  "turtle", "fin", "otter", "serpent", "shark",
  "cat", "mantis", "bear", "deer", "treant",
  "mouse", "lynx", "dragon", "hare", "bird",
  "unicorn", "owl", "bat", "fox-two-tail", "ghost",
  "goblin", "mantis-mech", "turtle-vault",
];

function drawShape(c: PixelCanvas, scale: number, shape: string, p: (typeof PALETTES)[1]): void {
  const body: [number, number][] = [];
  const dark: [number, number][] = [];
  const accent: [number, number][] = [];
  let eyes: [number, number][] = [];
  switch (shape) {
    case "cub":
      body.push([4, 8], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10]);
      dark.push([5, 8], [9, 8]); accent.push([11, 8], [12, 9], [11, 10]); eyes = [[6, 8], [9, 8]]; break;
    case "wolf":
      body.push([3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [2, 8], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8], [3, 9], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9]);
      dark.push([2, 8], [11, 8]); accent.push([12, 7], [13, 8], [12, 9]); eyes = [[4, 7], [8, 7]]; break;
    case "wolf-large":
      body.push([2, 6], [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7], [12, 7], [2, 8], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8], [3, 9], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9]);
      accent.push([13, 6], [14, 7], [13, 8], [1, 6], [0, 7]); dark.push([2, 7], [11, 7]); eyes = [[4, 7], [9, 7]]; break;
    case "fox":
      body.push([4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9]);
      accent.push([11, 6], [12, 6], [12, 7], [13, 7]); eyes = [[5, 7], [8, 7]]; break;
    case "boar":
      body.push([4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [3, 10], [11, 10]);
      accent.push([3, 8], [11, 8]); eyes = [[5, 7], [9, 7]]; break;
    case "turtle":
      body.push([4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10]);
      dark.push([5, 8], [6, 8], [7, 8], [8, 8], [9, 8]); accent.push([6, 8]); eyes = [[4, 7], [10, 7]]; break;
    case "fin":
      body.push([4, 8], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [5, 10]);
      accent.push([2, 8], [2, 9], [12, 7]); eyes = [[6, 7], [8, 7]]; break;
    case "otter":
      body.push([3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [5, 10], [6, 10], [7, 10], [8, 10]);
      dark.push([9, 8]); accent.push([11, 8]); eyes = [[4, 8], [6, 8]]; break;
    case "serpent":
      body.push([5, 6], [6, 6], [7, 6], [7, 7], [7, 8], [6, 8], [5, 8], [4, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [9, 10], [10, 10]);
      accent.push([5, 6], [9, 9]); eyes = [[7, 6]]; break;
    case "shark":
      body.push([3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [6, 10]);
      dark.push([3, 8]); accent.push([7, 5]); eyes = [[4, 8], [8, 8]]; break;
    case "cat":
      body.push([4, 8], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10]);
      accent.push([4, 6], [10, 6], [11, 10]); eyes = [[5, 8], [9, 8]]; break;
    case "mantis":
      body.push([6, 6], [6, 7], [5, 8], [6, 8], [7, 8], [6, 9], [5, 10], [6, 10], [7, 10], [6, 11]);
      accent.push([4, 7], [4, 8], [8, 7], [8, 8]); eyes = [[5, 6], [7, 6]]; break;
    case "bear":
      body.push([3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [3, 9], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [4, 10], [5, 10], [8, 10], [9, 10]);
      dark.push([3, 8], [10, 8]); accent.push([6, 9]); eyes = [[5, 7], [8, 7]]; break;
    case "deer":
      body.push([5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [4, 10], [10, 10]);
      accent.push([4, 5], [5, 5], [9, 5], [10, 5]); eyes = [[6, 7], [8, 7]]; break;
    case "treant":
      body.push([6, 6], [7, 6], [5, 7], [6, 7], [7, 7], [8, 7], [5, 8], [6, 8], [7, 8], [8, 8], [5, 9], [6, 9], [7, 9], [8, 9], [6, 10], [7, 10], [6, 11], [7, 11]);
      dark.push([6, 8], [7, 8]); accent.push([4, 7], [9, 7], [4, 9], [9, 9]); eyes = [[6, 7], [7, 7]]; break;
    case "mouse":
      body.push([5, 8], [6, 7], [7, 7], [8, 7], [9, 7], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [6, 10], [7, 10], [8, 10]);
      accent.push([4, 7], [10, 10]); eyes = [[6, 8], [9, 8]]; break;
    case "lynx":
      body.push([4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9]);
      accent.push([4, 5], [10, 5]); eyes = [[5, 7], [8, 7]]; break;
    case "dragon":
      body.push([4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [5, 10], [8, 10]);
      accent.push([2, 5], [3, 5], [11, 5], [12, 5], [2, 6], [12, 6]); eyes = [[5, 7], [9, 7]]; break;
    case "hare":
      body.push([5, 8], [6, 7], [7, 7], [8, 7], [9, 7], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [6, 10], [7, 10], [8, 10]);
      accent.push([5, 5], [6, 5], [8, 5], [9, 5]); eyes = [[6, 8], [9, 8]]; break;
    case "bird":
      body.push([6, 7], [7, 7], [8, 7], [6, 8], [7, 8], [8, 8], [6, 9], [7, 9], [8, 9], [7, 10]);
      accent.push([3, 6], [4, 6], [10, 6], [11, 6], [3, 7], [11, 7]); eyes = [[6, 7], [8, 7]]; break;
    case "unicorn":
      body.push([4, 8], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10]);
      accent.push([7, 5], [7, 6], [2, 6], [12, 6], [2, 12], [12, 12]); eyes = [[5, 8], [9, 8]]; break;
    case "owl":
      body.push([5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [6, 9], [7, 9], [8, 9]);
      accent.push([5, 5], [9, 5]); eyes = [[6, 6], [8, 6]]; break;
    case "bat":
      body.push([6, 7], [7, 7], [8, 7], [6, 8], [7, 8], [8, 8], [6, 9], [7, 9], [8, 9]);
      accent.push([3, 6], [4, 6], [10, 6], [11, 6], [3, 7], [11, 7], [4, 11], [10, 11]); eyes = [[6, 7], [8, 7]]; break;
    case "fox-two-tail":
      body.push([4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9]);
      accent.push([11, 5], [12, 5], [12, 6], [11, 9], [12, 9], [12, 10]); eyes = [[5, 7], [8, 7]]; break;
    case "ghost":
      body.push([5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [5, 10], [7, 10], [9, 10]);
      accent.push([3, 7], [11, 7]); eyes = [[6, 6], [8, 6]]; break;
    case "goblin":
      body.push([5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [6, 10], [7, 10]);
      dark.push([10, 7], [10, 8], [10, 9]); accent.push([11, 7]); eyes = [[6, 7], [8, 7]]; break;
    case "mantis-mech":
      body.push([6, 6], [6, 7], [5, 8], [6, 8], [7, 8], [6, 9], [5, 10], [6, 10], [7, 10], [6, 11]);
      accent.push([3, 7], [4, 7], [8, 7], [9, 7], [3, 8], [9, 8]); eyes = [[5, 6], [7, 6]]; break;
    case "turtle-vault":
      body.push([3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [4, 10], [5, 10], [9, 10], [10, 10]);
      dark.push([5, 8], [6, 8], [7, 8], [8, 8], [9, 8]); accent.push([6, 8], [8, 8]); eyes = [[4, 7], [10, 7]]; break;
    default:
      body.push([5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [6, 9], [7, 9]);
      eyes = [[6, 7], [8, 7]];
  }

  const put = (x: number, y: number, color: string) => {
    for (let dy = 0; dy < scale; dy++) {
      for (let dx = 0; dx < scale; dx++) c.px(x * scale + dx, y * scale + dy, color);
    }
  };

  const outlineSet = new Set<string>();
  for (const [x, y] of body) {
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      outlineSet.add(`${x + ox},${y + oy}`);
    }
  }
  for (const [x, y] of body) outlineSet.delete(`${x},${y}`);
  for (const key of outlineSet) {
    const [x, y] = key.split(",").map(Number) as [number, number];
    put(x, y, p.outline);
  }
  for (const [x, y] of body) put(x, y, p.body);
  for (const [x, y] of dark) put(x, y, p.dark);
  for (const [x, y] of accent) put(x, y, p.accent);
  for (const [x, y] of eyes) put(x, y, p.eye);
}

// ---------- main ----------

const SLUGS = [
  "firecub", "firewolf", "infernowolf", "emberfox", "magmaboar",
  "aquaturtle", "bubblefin", "tideotter", "coralserpent", "abyssshark",
  "leafcat", "bloommantis", "mossbear", "thorndeer", "ancienttreant",
  "sparkmouse", "staticlynx", "stormdragon", "volthare", "thunderbird",
  "swapicorn", "oracleowl", "zkbat", "bridgefox", "lendgeist",
  "gasgoblin", "mevmantis", "vaultturtle",
];

const OUT_DIR = path.join(__dirname, "..", "apps", "web", "public", "game", "monsters");

function main() {
  let count = 0;
  for (let speciesId = 1; speciesId <= 28; speciesId++) {
    const shape = SHAPES[speciesId - 1]!;
    const palette = PALETTES[speciesId]!;
    const slug = SLUGS[speciesId - 1]!;
    const dir = path.join(OUT_DIR, `${String(speciesId).padStart(3, "0")}-${slug}`);
    mkdirSync(dir, { recursive: true });

    // overworld 32×32 (16×16 grid at 2px cells)
    const ow = new PixelCanvas(32, 32);
    drawShape(ow, 2, shape, palette);
    writeFileSync(path.join(dir, "overworld.png"), encodePng(32, 32, ow.data));

    // battle-front 64×64
    const bf = new PixelCanvas(64, 64);
    drawShape(bf, 4, shape, palette);
    writeFileSync(path.join(dir, "battle-front.png"), encodePng(64, 64, bf.data));

    // portrait 128×128
    const pt = new PixelCanvas(128, 128);
    drawShape(pt, 8, shape, palette);
    writeFileSync(path.join(dir, "portrait.png"), encodePng(128, 128, pt.data));

    count += 3;
  }
  console.log(`Generated ${count} sprite PNGs (28 species × 3 sizes) into apps/web/public/game/monsters/`);
}

main();
