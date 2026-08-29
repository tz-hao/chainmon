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
  buildWorldMap,
  type WorldMapData,
} from "../../lib/world/map-data";
import {
  PLAYER_RENDER_SCALE,
  PLAYER_SPEED,
  WORLD_TILE_SIZE,
  MONSTER_OVERWORLD_SCALE,
  POSITION_SAVE_THROTTLE_MS,
} from "../../lib/world/world-config";
import { seededRandom } from "../../lib/world/zones";
import { getMonsterVisualPath } from "../../lib/world/monster-visuals";
import { ensureMonsterTexture, ensurePlayerTextures } from "../textures/pixel-art";

const EMPTY_WORLD_STATE: WorldStateResponse = {
  trainer: {
    id: "",
    nickname: "Trainer",
    gold: 0,
    worldMap: "whispering-forest",
    worldX: 30,
    worldY: 24,
    zoneId: null,
  },
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
  homeTileX: number;
  homeTileY: number;
  sprite: Phaser.Physics.Arcade.Sprite;
  marker: Phaser.GameObjects.Text;
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
  private pendingEncounterSpawnId: string | null = null;

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
    const worldState = this.game.registry.get("worldState") as WorldStateResponse;
    this.map = buildWorldMap(worldState.trainer.worldMap);
    this.renderMap();
    this.renderLandmarks();
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

  /** Make the purpose of camp NPCs and world rewards clear at a glance. */
  private renderLandmarks(): void {
    const placeNpc = (
      x: number,
      y: number,
      texture: "npc-shop" | "npc-guide",
      label: string,
      color: string,
    ) => {
      const px = x * WORLD_TILE_SIZE + WORLD_TILE_SIZE / 2;
      const py = y * WORLD_TILE_SIZE + WORLD_TILE_SIZE / 2;
      this.add.sprite(px, py, texture).setDepth(6);
      this.add
        .text(px, py - 24, label, {
          fontFamily: "monospace",
          fontSize: "10px",
          color,
          backgroundColor: "#101828cc",
          padding: { x: 3, y: 2 },
        })
        .setOrigin(0.5)
        .setDepth(7);
    };

    placeNpc(this.map.shopNpc.x, this.map.shopNpc.y, "npc-shop", "BALL SHOP", "#fcd34d");
    placeNpc(this.map.guideNpc.x, this.map.guideNpc.y, "npc-guide", "新手指南", "#86efac");

    const worldState = this.game.registry.get("worldState") as WorldStateResponse;
    for (const pickup of worldState.pickups ?? []) {
      if (!pickup.available) continue;
      const texture =
        pickup.kind === "gold-chest"
          ? "pickup-gold"
          : pickup.kind === "purple-spark"
            ? "pickup-purple"
            : "pickup-blue";
      const px = pickup.x * WORLD_TILE_SIZE + WORLD_TILE_SIZE / 2;
      const py = pickup.y * WORLD_TILE_SIZE + WORLD_TILE_SIZE / 2;
      const sprite = this.add.sprite(px, py, texture).setDepth(6);
      this.tweens.add({
        targets: sprite,
        y: py - 3,
        duration: 850,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
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
      .setCollideWorldBounds(true)
      .setDepth(10);
    this.lastFacing = "down";
    this.player.play("player-anim-down");
  }

  private setupCamera(): void {
    const worldWidth = this.map.cols * WORLD_TILE_SIZE;
    const worldHeight = this.map.rows * WORLD_TILE_SIZE;
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.18, 0.18);
    this.cameras.main.setDeadzone(0, 0);
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
        .setCollideWorldBounds(true)
        .setDepth(5);
      const marker = this.add
        .text(px, py - 26, "✦", {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#fde68a",
          stroke: "#1e293b",
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(8);
      const rng = seededRandom(spawn.speciesId * 7919 + (spawn.x * 13 + spawn.y * 17));
      const rare = spawn.speciesId >= 18;
      this.monsters.push({
        spawnId: spawn.spawnId,
        speciesId: spawn.speciesId,
        homeTileX: spawn.x,
        homeTileY: spawn.y,
        sprite,
        marker,
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
    // Player scale and all collision checks use the same source-pixel units.
    const half = WORLD_TILE_SIZE * PLAYER_RENDER_SCALE * 0.75;
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
          const direction = this.nextMonsterDirection(m);
          if (direction) {
            m.state = "walk";
            m.walkTimer = 500 + Math.random() * 900;
            [m.dirX, m.dirY] = direction;
          } else {
            m.idleTimer = 700 + Math.random() * 1500;
          }
        }
      } else {
        m.walkTimer -= delta;
        // Spawns are server-authoritative. Keep the visual wander within one
        // tile of the stored spawn so contact in Phaser also satisfies the
        // server's interaction-distance check against that stored position.
        const tileX = Math.floor(m.sprite.x / WORLD_TILE_SIZE);
        const tileY = Math.floor(m.sprite.y / WORLD_TILE_SIZE);
        const nextTileX = tileX + m.dirX;
        const nextTileY = tileY + m.dirY;
        if (!this.canMonsterWalkTo(m, nextTileX, nextTileY)) {
          const direction = this.nextMonsterDirection(m);
          if (!direction) {
            m.state = "idle";
            m.idleTimer = 700 + Math.random() * 1500;
            m.sprite.setVelocity(0, 0);
            m.marker.setPosition(m.sprite.x, m.sprite.y - 26);
            continue;
          }
          [m.dirX, m.dirY] = direction;
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
      m.marker.setPosition(m.sprite.x, m.sprite.y - 26);
      void time;
    }
  }

  private canMonsterWalkTo(
    monster: WildMonsterSprite,
    tileX: number,
    tileY: number,
  ): boolean {
    return (
      this.isWalkable(tileX, tileY) &&
      Math.hypot(tileX - monster.homeTileX, tileY - monster.homeTileY) <= 1
    );
  }

  private nextMonsterDirection(monster: WildMonsterSprite): readonly [number, number] | null {
    const tileX = Math.floor(monster.sprite.x / WORLD_TILE_SIZE);
    const tileY = Math.floor(monster.sprite.y / WORLD_TILE_SIZE);
    const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const;
    const available = directions.filter(([dx, dy]) =>
      this.canMonsterWalkTo(monster, tileX + dx, tileY + dy),
    );
    return available[Math.floor(Math.random() * available.length)] ?? null;
  }

  private updateInteraction(): void {
    const playerTileX = Math.floor(this.player.x / WORLD_TILE_SIZE);
    const playerTileY = Math.floor(this.player.y / WORLD_TILE_SIZE);
    const zoneName = this.map.name;
    if (zoneName !== this.lastZoneName) {
      this.lastZoneName = zoneName;
      window.dispatchEvent(
        new CustomEvent("phaser:zone-changed", {
          detail: { zoneName },
        }),
      );
    }

    // After running from an encounter, suppress only that same nearby spawn.
    // Once the trainer has stepped away, proximity encounters become available
    // again (including for other wild ChainMon).
    if (this.pendingEncounterSpawnId) {
      const pendingMonster = this.monsters.find(
        (monster) => monster.spawnId === this.pendingEncounterSpawnId,
      );
      if (
        !pendingMonster ||
        Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          pendingMonster.sprite.x,
          pendingMonster.sprite.y,
        ) > 96
      ) {
        this.pendingEncounterSpawnId = null;
      }
    }

    let near: { kind: string; id: string; label: string } | null = null;
    for (const m of this.monsters) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        m.sprite.x,
        m.sprite.y,
      );
      if (dist < 64) {
        if (dist < 32 && !this.pendingEncounterSpawnId) {
          this.pendingEncounterSpawnId = m.spawnId;
          window.dispatchEvent(
            new CustomEvent("phaser:interact", {
              detail: {
                kind: "monster",
                id: m.spawnId,
                x: playerTileX,
                y: playerTileY,
              },
            }),
          );
        }
        near = {
          kind: "monster",
          id: m.spawnId,
          label: "接触野生精灵即可遭遇 · E 也可触发",
        };
        break;
      }
    }
    if (!near) {
      const pickup = this.findNearPickup(playerTileX, playerTileY);
      if (pickup) near = { kind: "pickup", id: pickup, label: "Press E to collect" };
    }
    if (!near) {
      const npc = this.findNearNpc(playerTileX, playerTileY);
      if (npc) near = {
        kind: npc.kind,
        id: npc.id,
        label: npc.kind === "guide" ? "Press E for 新手指南" : "Press E for Ball Shop",
      };
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
        m.marker.destroy();
      }
    }
    this.monsters = this.monsters.filter((m) => !spawnIdsToRemove.includes(m.spawnId));
  }
}
