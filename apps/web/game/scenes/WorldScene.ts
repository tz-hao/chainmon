/**
 * ChainMon Pixel World — WorldScene.
 * Phaser owns: player movement, camera, collisions, spawn visuals, world
 * loop. React owns: HUD, modals, API calls (via an event bridge).
 *
 * Bridge events (window CustomEvents):
 *   phaser:zone-changed   { zoneId, zoneName }
 *   phaser:interact       { kind, id, x, y } (current player tile)
 *   phaser:position       { x, y }          (throttled)
 */

import Phaser from "phaser";
import type { WorldStateResponse } from "../../lib/world/world-types";
import {
  BLOCKED_TILES,
  buildChainMonValley,
  type WorldMapData,
} from "../../lib/world/map-data";
import {
  PLAYER_RENDER_SCALE,
  PLAYER_SPEED,
  WORLD_TILE_SIZE,
  MONSTER_OVERWORLD_SCALE,
  POSITION_SAVE_THROTTLE_MS,
} from "../../lib/world/world-config";
import { zoneNameAt, seededRandom } from "../../lib/world/zones";
import { getMonsterVisualPath } from "../../lib/world/monster-visuals";
import { ensureMonsterTexture, ensurePlayerTextures } from "../textures/pixel-art";

const EMPTY_WORLD_STATE: WorldStateResponse = {
  trainer: { id: "", nickname: "Trainer", gold: 0, worldX: 30, worldY: 24, zoneId: null },
  spawns: [],
  pickups: [],
  dailySupply: { ready: false, nextAt: null },
  inventory: [],
};

interface WorldSceneData {
  worldState?: WorldStateResponse;
}

interface WildMonsterSprite {
  spawnId: string;
  speciesId: number;
  sprite: Phaser.Physics.Arcade.Sprite;
  state: "idle" | "walk";
  idleTimer: number;
  walkTimer: number;
  dirX: number;
  dirY: number;
  baseSpeed: number;
}

export class WorldScene extends Phaser.Scene {
  private map!: WorldMapData;
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private monsters: WildMonsterSprite[] = [];
  private lastZoneName = "";
  private lastPositionSave = 0;
  private lastFacing: "down" | "left" | "right" | "up" = "down";
  private nearInteract: { kind: string; id: string; label: string } | null = null;
  private interactHint!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "WorldScene" });
  }

  init(data: WorldSceneData): void {
    // world state supplied by React before scene start (game-level registry
    // or init data — scene-level registry is NOT shared).
    const resolved =
      data.worldState ?? this.game.registry.get("worldState") ?? EMPTY_WORLD_STATE;
    this.game.registry.set("worldState", resolved);
  }

  preload(): void {
    const worldState = this.game.registry.get("worldState") as WorldStateResponse;
    const loaded = new Set<number>();
    for (const spawn of worldState?.spawns ?? []) {
      if (loaded.has(spawn.speciesId)) continue;
      loaded.add(spawn.speciesId);
      this.load.image(
        this.monsterTextureKey(spawn.speciesId),
        getMonsterVisualPath(spawn.speciesId, "overworld"),
      );
    }
  }

  create(): void {
    this.map = buildChainMonValley();
    this.renderMap();
    this.spawnPlayer();
    this.setupCamera();
    this.spawnWildMonsters();
    this.setupInput();
    this.setupInteractHint();
  }

  // ---------------------------------------------------------------- map

  private renderMap(): void {
    const { cols, rows, tiles } = this.map;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const code = tiles[y * cols + x]!;
        const key = `tile-${code}`;
        this.add
          .image(x * WORLD_TILE_SIZE, y * WORLD_TILE_SIZE, key)
          .setOrigin(0, 0);
      }
    }
  }

  private isWalkable(tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileY < 0 || tileX >= this.map.cols || tileY >= this.map.rows) {
      return false;
    }
    const code = this.map.tiles[tileY * this.map.cols + tileX]!;
    return !BLOCKED_TILES.has(code);
  }

  // ---------------------------------------------------------------- player

  private spawnPlayer(): void {
    const worldState = this.game.registry.get("worldState") as WorldStateResponse;
    ensurePlayerTextures(this);
    const startX = Number.isFinite(worldState?.trainer?.worldX)
      ? worldState.trainer.worldX * WORLD_TILE_SIZE + WORLD_TILE_SIZE / 2
      : 30 * WORLD_TILE_SIZE + WORLD_TILE_SIZE / 2;
    const startY = Number.isFinite(worldState?.trainer?.worldY)
      ? worldState.trainer.worldY * WORLD_TILE_SIZE + WORLD_TILE_SIZE / 2
      : 24 * WORLD_TILE_SIZE + WORLD_TILE_SIZE / 2;

    this.player = this.physics.add
      .sprite(startX, startY, "player-down-0")
      .setScale(PLAYER_RENDER_SCALE)
      .setDepth(10);
    this.lastFacing = "down";
    this.player.play("player-anim-down");
  }

  private setupCamera(): void {
    const worldWidth = this.map.cols * WORLD_TILE_SIZE;
    const worldHeight = this.map.rows * WORLD_TILE_SIZE;
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(140, 90);
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
  }

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D") as Record<
      "W" | "A" | "S" | "D",
      Phaser.Input.Keyboard.Key
    >;
    const eKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    eKey.on("down", () => this.handleInteract());
  }

  private setupInteractHint(): void {
    this.interactHint = this.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffe066",
        backgroundColor: "#101828cc",
        padding: { x: 6, y: 3 },
      })
      .setDepth(50)
      .setVisible(false);
  }

  // ---------------------------------------------------------------- wild monsters

  private spawnWildMonsters(): void {
    const worldState = this.game.registry.get("worldState") as WorldStateResponse;
    for (const spawn of worldState.spawns ?? []) {
      const assetTextureKey = this.monsterTextureKey(spawn.speciesId);
      const textureKey = this.textures.exists(assetTextureKey)
        ? assetTextureKey
        : ensureMonsterTexture(this, spawn.speciesId, `monster-${spawn.speciesId}`);
      const px = spawn.x * WORLD_TILE_SIZE + WORLD_TILE_SIZE / 2;
      const py = spawn.y * WORLD_TILE_SIZE + WORLD_TILE_SIZE / 2;
      const sprite = this.physics.add
        .sprite(px, py, textureKey)
        .setScale(MONSTER_OVERWORLD_SCALE)
        .setDepth(5);
      const rng = seededRandom(spawn.speciesId * 7919 + (spawn.x * 13 + spawn.y * 17));
      const rare = spawn.speciesId >= 18;
      this.monsters.push({
        spawnId: spawn.spawnId,
        speciesId: spawn.speciesId,
        sprite,
        state: "idle",
        idleTimer: 600 + rng() * 1400,
        walkTimer: 0,
        dirX: 0,
        dirY: 0,
        baseSpeed: rare ? 46 : 30,
      });
    }
  }

  private monsterTextureKey(speciesId: number): string {
    return `monster-overworld-${speciesId}`;
  }

  // ---------------------------------------------------------------- update loop

  update(time: number, delta: number): void {
    this.updatePlayer(delta);
    this.updateMonsters(time, delta);
    this.updateInteraction();
    this.emitPosition(delta);
  }

  private updatePlayer(delta: number): void {
    const input = {
      up: this.cursors.up.isDown || this.keys.W.isDown,
      down: this.cursors.down.isDown || this.keys.S.isDown,
      left: this.cursors.left.isDown || this.keys.A.isDown,
      right: this.cursors.right.isDown || this.keys.D.isDown,
    };
    let dx = 0;
    let dy = 0;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    const moving = dx !== 0 || dy !== 0;
    if (!moving) {
      this.player.setVelocity(0, 0);
      this.player.stop();
      this.player.setTexture(`player-${this.lastFacing}-0`);
      return;
    }
    const len = Math.hypot(dx, dy) || 1;
    const speedPx = PLAYER_SPEED * PLAYER_RENDER_SCALE;

    // --- Tile collision (axis-separated): water/rock/tree/wall/NPC block ---
    const half = WORLD_TILE_SIZE * PLAYER_RENDER_SCALE * 0.32;
    const tileX = Math.floor(this.player.x / WORLD_TILE_SIZE);
    const tileY = Math.floor(this.player.y / WORLD_TILE_SIZE);

    let vx = (dx / len) * speedPx;
    let vy = (dy / len) * speedPx;
    if (vx !== 0) {
      const leadX = Math.floor((this.player.x + Math.sign(vx) * half) / WORLD_TILE_SIZE);
      if (!this.isWalkable(leadX, tileY)) vx = 0;
    }
    if (vy !== 0) {
      const leadY = Math.floor((this.player.y + Math.sign(vy) * half) / WORLD_TILE_SIZE);
      if (!this.isWalkable(tileX, leadY)) vy = 0;
    }

    this.player.setVelocity(vx, vy);
    // face direction + play the matching walk animation
    const facing: "down" | "left" | "right" | "up" =
      Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    if (facing !== this.lastFacing) {
      this.lastFacing = facing;
      this.player.play(`player-anim-${facing}`);
    }
  }

  private updateMonsters(time: number, delta: number): void {
    for (const m of this.monsters) {
      if (m.state === "idle") {
        m.idleTimer -= delta;
        m.sprite.setVelocity(0, 0);
        if (m.idleTimer <= 0) {
          m.state = "walk";
          m.walkTimer = 500 + Math.random() * 900;
          const dirs = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const;
          const [dx2, dy2] = dirs[Math.floor(Math.random() * dirs.length)]!;
          m.dirX = dx2;
          m.dirY = dy2;
        }
      } else {
        m.walkTimer -= delta;
        // try walk; if blocked, pick a new direction
        const tileX = Math.floor(m.sprite.x / WORLD_TILE_SIZE);
        const tileY = Math.floor(m.sprite.y / WORLD_TILE_SIZE);
        const nextTileX = tileX + m.dirX;
        const nextTileY = tileY + m.dirY;
        if (!this.isWalkable(nextTileX, nextTileY)) {
          const dirs = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const;
          const [dx2, dy2] = dirs[Math.floor(Math.random() * dirs.length)]!;
          m.dirX = dx2;
          m.dirY = dy2;
        }
        m.sprite.setVelocity(
          m.dirX * m.baseSpeed * MONSTER_OVERWORLD_SCALE,
          m.dirY * m.baseSpeed * MONSTER_OVERWORLD_SCALE,
        );
        if (m.walkTimer <= 0) {
          m.state = "idle";
          m.idleTimer = 700 + Math.random() * 1500;
          m.sprite.setVelocity(0, 0);
        }
      }
      void time;
    }
  }

  private updateInteraction(): void {
    const playerTileX = Math.floor(this.player.x / WORLD_TILE_SIZE);
    const playerTileY = Math.floor(this.player.y / WORLD_TILE_SIZE);
    const zoneName = zoneNameAt(playerTileX, playerTileY);
    if (zoneName !== this.lastZoneName) {
      this.lastZoneName = zoneName;
      window.dispatchEvent(
        new CustomEvent("phaser:zone-changed", {
          detail: { zoneName },
        }),
      );
    }

    let near: { kind: string; id: string; label: string } | null = null;
    for (const m of this.monsters) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        m.sprite.x,
        m.sprite.y,
      );
      if (dist < 40) {
        near = { kind: "monster", id: m.spawnId, label: "Press E to encounter" };
        break;
      }
    }
    if (!near) {
      const pickup = this.findNearPickup(playerTileX, playerTileY);
      if (pickup) near = { kind: "pickup", id: pickup, label: "Press E to collect" };
    }
    if (!near) {
      const npc = this.findNearNpc(playerTileX, playerTileY);
      if (npc) near = { kind: npc.kind, id: npc.id, label: "Press E to talk" };
    }
    this.nearInteract = near;
    if (near && this.player.active) {
      this.interactHint
        .setText(near.label)
        .setPosition(
          this.player.x,
          this.player.y - 40 * PLAYER_RENDER_SCALE,
        )
        .setOrigin(0.5)
        .setVisible(true);
    } else {
      this.interactHint.setVisible(false);
    }
  }

  private findNearPickup(playerTileX: number, playerTileY: number): string | null {
    const worldState = this.game.registry.get("worldState") as WorldStateResponse;
    for (const p of worldState.pickups ?? []) {
      if (Math.abs(p.x - playerTileX) <= 1 && Math.abs(p.y - playerTileY) <= 1) {
        return p.pickupKey;
      }
    }
    return null;
  }

  private findNearNpc(
    playerTileX: number,
    playerTileY: number,
  ): { kind: "shop" | "guide"; id: string } | null {
    const { shopNpc, guideNpc } = this.map;
    if (Math.abs(shopNpc.x - playerTileX) <= 1 && Math.abs(shopNpc.y - playerTileY) <= 1) {
      return { kind: "shop", id: "shop-npc" };
    }
    if (Math.abs(guideNpc.x - playerTileX) <= 1 && Math.abs(guideNpc.y - playerTileY) <= 1) {
      return { kind: "guide", id: "guide-npc" };
    }
    return null;
  }

  private handleInteract(): void {
    if (!this.nearInteract) return;
    window.dispatchEvent(
      new CustomEvent("phaser:interact", {
        detail: {
          ...this.nearInteract,
          x: Math.floor(this.player.x / WORLD_TILE_SIZE),
          y: Math.floor(this.player.y / WORLD_TILE_SIZE),
        },
      }),
    );
  }

  private emitPosition(delta: number): void {
    this.lastPositionSave += delta;
    if (this.lastPositionSave < POSITION_SAVE_THROTTLE_MS) return;
    this.lastPositionSave = 0;
    window.dispatchEvent(
      new CustomEvent("phaser:position", {
        detail: {
          x: Math.floor(this.player.x / WORLD_TILE_SIZE),
          y: Math.floor(this.player.y / WORLD_TILE_SIZE),
        },
      }),
    );
  }

  /** Called by React when the world state changes (e.g. after capture). */
  refreshSpawns(spawnIdsToRemove: string[]): void {
    for (const m of this.monsters) {
      if (spawnIdsToRemove.includes(m.spawnId)) {
        m.sprite.destroy();
      }
    }
    this.monsters = this.monsters.filter((m) => !spawnIdsToRemove.includes(m.spawnId));
  }
}
