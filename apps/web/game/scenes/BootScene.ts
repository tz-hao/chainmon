/**
 * ChainMon Pixel World — BootScene.
 * Generates all runtime textures (tiles, player, capsules) before the
 * WorldScene starts. No external assets required.
 */

import Phaser from "phaser";
import { WORLD_TILE_SIZE } from "../../lib/world/world-config";

const TILE_COLORS: Record<string, { fill: string; detail: string }> = {
  ".": { fill: "#3f8f4f", detail: "#4fa25f" }, // grass
  g: { fill: "#2f7f3f", detail: "#6fbf5f" }, // wild grass
  w: { fill: "#2f6fbf", detail: "#5fa0df" }, // water
  t: { fill: "#2c5c2e", detail: "#3f7f43" }, // tree
  r: { fill: "#6f6f77", detail: "#8a8a94" }, // rock
  "#": { fill: "#2a2a32", detail: "#3c3c46" }, // wall
  v: { fill: "#c0392b", detail: "#e06a3a" }, // lava
  p: { fill: "#c8a86a", detail: "#d8bc80" }, // path
  c: { fill: "#a8844f", detail: "#b89260" }, // camp floor
  n: { fill: "#a8844f", detail: "#b89260" }, // npc tile (floor under sprite)
  s: { fill: "#a8844f", detail: "#b89260" }, // shop tile (floor under sprite)
  B: { fill: "#3f8f4f", detail: "#4fa25f" }, // pickup tile (floor)
};

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  create(): void {
    this.generateTileTextures();
    this.generatePickupTextures();
    this.generateCapsuleTextures();
    this.generateNpcTextures();
    this.scene.start("WorldScene", {
      worldState: this.game.registry.get("worldState"),
    });
  }

  private generateTileTextures(): void {
    for (const [code, colors] of Object.entries(TILE_COLORS)) {
      const key = `tile-${code}`;
      if (this.textures.exists(key)) continue;
      const canvas = document.createElement("canvas");
      canvas.width = WORLD_TILE_SIZE;
      canvas.height = WORLD_TILE_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = colors.fill;
      ctx.fillRect(0, 0, WORLD_TILE_SIZE, WORLD_TILE_SIZE);
      ctx.fillStyle = colors.detail;
      // deterministic detail pattern
      for (let i = 0; i < 6; i++) {
        const x = ((i * 7 + code.length) % WORLD_TILE_SIZE);
        const y = ((i * 11 + code.length * 3) % WORLD_TILE_SIZE);
        ctx.fillRect(x, y, 2, 2);
      }
      this.textures.addCanvas(key, canvas);
    }
  }

  private generatePickupTextures(): void {
    const pickups = {
      "pickup-blue": { glow: "#4fc3f7", core: "#e1f5fe" },
      "pickup-purple": { glow: "#ab47bc", core: "#f3e5f5" },
      "pickup-gold": { glow: "#f9a825", core: "#fff8e1" },
    };
    for (const [key, colors] of Object.entries(pickups)) {
      if (this.textures.exists(key)) continue;
      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = colors.glow;
      ctx.fillRect(2, 2, 12, 12);
      ctx.fillStyle = colors.core;
      ctx.fillRect(5, 5, 6, 6);
      this.textures.addCanvas(key, canvas);
    }
  }

  /** Original ChainMon Capture Capsules (NOT Poké Ball copies). */
  private generateCapsuleTextures(): void {
    const capsules = {
      "capsule-basic": { top: "#f5f7fa", bottom: "#4fc3f7", ring: "#b0bec5", core: "#0d47a1" },
      "capsule-great": { top: "#5c6bc0", bottom: "#7e57c2", ring: "#d1c4e9", core: "#311b92" },
      "capsule-ultra": { top: "#212121", bottom: "#f9a825", ring: "#ffd54f", core: "#ffd54f" },
    };
    for (const [key, colors] of Object.entries(capsules)) {
      if (this.textures.exists(key)) continue;
      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.imageSmoothingEnabled = false;
      // ring band
      ctx.fillStyle = colors.ring;
      ctx.fillRect(2, 7, 12, 2);
      // top half
      ctx.fillStyle = colors.top;
      ctx.beginPath();
      ctx.moveTo(2, 7);
      ctx.lineTo(14, 7);
      ctx.lineTo(12, 2);
      ctx.lineTo(4, 2);
      ctx.closePath();
      ctx.fill();
      // bottom half
      ctx.fillStyle = colors.bottom;
      ctx.beginPath();
      ctx.moveTo(2, 9);
      ctx.lineTo(14, 9);
      ctx.lineTo(12, 14);
      ctx.lineTo(4, 14);
      ctx.closePath();
      ctx.fill();
      // hexagon core
      ctx.fillStyle = colors.core;
      ctx.beginPath();
      ctx.moveTo(8, 6);
      ctx.lineTo(10, 7);
      ctx.lineTo(10, 9);
      ctx.lineTo(8, 10);
      ctx.lineTo(6, 9);
      ctx.lineTo(6, 7);
      ctx.closePath();
      ctx.fill();
      this.textures.addCanvas(key, canvas);
    }
  }

  private generateNpcTextures(): void {
    const npcs = {
      "npc-guide": { body: "#2f8f5b", head: "#e8c39a" },
      "npc-shop": { body: "#7e57c2", head: "#e8c39a" },
    };
    for (const [key, colors] of Object.entries(npcs)) {
      if (this.textures.exists(key)) continue;
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = colors.body;
      ctx.fillRect(8, 14, 16, 12);
      ctx.fillStyle = colors.head;
      ctx.fillRect(10, 5, 12, 10);
      ctx.fillStyle = "#101828";
      ctx.fillRect(12, 9, 2, 2);
      ctx.fillRect(18, 9, 2, 2);
      this.textures.addCanvas(key, canvas);
    }
  }
}
