"use client";

import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { BootScene } from "@/game/scenes/BootScene";
import { WorldScene } from "@/game/scenes/WorldScene";
import { WORLD_RENDER } from "@/lib/world/world-config";
import type { WorldStateResponse } from "@/lib/world/world-types";

interface PhaserGameProps {
  worldState: WorldStateResponse;
  onGameReady: (game: Phaser.Game) => void;
}

/**
 * Client-only Phaser mount (never SSR). BootScene generates runtime
 * textures; WorldScene receives the server world state via the registry.
 */
export function PhaserGame({ worldState, onGameReady }: PhaserGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || readyRef.current) return;
    readyRef.current = true;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: WORLD_RENDER.width,
      height: WORLD_RENDER.height,
      pixelArt: WORLD_RENDER.pixelArt,
      roundPixels: WORLD_RENDER.roundPixels,
      backgroundColor: "#1a1a22",
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: "arcade",
        arcade: { gravity: { x: 0, y: 0 }, debug: false },
      },
      scene: [BootScene, WorldScene],
    });

    // Inject the world state before the WorldScene starts.
    game.registry.set("worldState", worldState);
    onGameReady(game);

    return () => {
      game.destroy(true);
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full w-full [image-rendering:pixelated]"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
