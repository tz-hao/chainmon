"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type Phaser from "phaser";
import type { WorldStateResponse } from "@/lib/world/world-types";
import { WorldHUD } from "./WorldHUD";
import { EncounterOverlay } from "./EncounterOverlay";
import { ShopOverlay } from "./ShopOverlay";
import { GuideOverlay } from "./GuideOverlay";

const PhaserGame = dynamic(
  () => import("./PhaserGame").then((m) => m.PhaserGame),
  { ssr: false },
);

interface PixelWorldProps {
  initialWorldState?: WorldStateResponse;
}

interface InteractTarget {
  kind: string;
  id: string;
  label?: string;
  x?: number;
  y?: number;
}

/**
 * Pixel World page composition: Phaser canvas + React HUD/overlays.
 * Phaser drives movement; React handles HUD, modals and API calls.
 */
export function PixelWorld(_props: PixelWorldProps) {
  const router = useRouter();
  const [worldState, setWorldState] = useState<WorldStateResponse | null>(null);
  const [worldLoadError, setWorldLoadError] = useState<string | null>(null);
  const [worldRevision, setWorldRevision] = useState(0);
  const [zoneName, setZoneName] = useState("Trainer Camp");
  const [interact, setInteract] = useState<InteractTarget | null>(null);
  const [encounter, setEncounter] = useState<{
    encounterId: string;
    speciesId: number;
    speciesName: string;
    element: string;
    rarity: string;
    level: number;
    currentHp: number;
    maxHp: number;
    catchChancePreview: number;
  } | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [dailyBusy, setDailyBusy] = useState(false);
  const busyRef = useRef(false);
  const tutorialTrainerRef = useRef<string | null>(null);

  const onGameReady = useCallback((_game: Phaser.Game) => undefined, []);

  const refreshWorldState = useCallback(async () => {
    setWorldLoadError(null);
    const res = await fetch("/api/world/state");
    const data = (await res.json()) as WorldStateResponse & { error?: string };
    if (!res.ok) throw new Error(data.error ?? "World temporarily unavailable.");
    setWorldState(data);
    setWorldRevision((revision) => revision + 1);
    return data;
  }, []);

  // The canvas is deliberately withheld until the authoritative snapshot has
  // arrived. This prevents a default world from flashing before real spawns,
  // pickups, inventory and saved position are available.
  useEffect(() => {
    void refreshWorldState().catch((error) => {
      setWorldLoadError(error instanceof Error ? error.message : "World temporarily unavailable.");
    });
  }, [refreshWorldState]);

  // A trainer sees this once per browser. The Guide button remains available
  // after dismissal, so the first visit is helpful without becoming a wall.
  useEffect(() => {
    const trainerId = worldState?.trainer.id;
    if (!trainerId || tutorialTrainerRef.current === trainerId) return;
    tutorialTrainerRef.current = trainerId;
    try {
      if (!window.localStorage.getItem(`chainmon:world-tutorial:${trainerId}`)) {
        setTutorialOpen(true);
      }
    } catch {
      setTutorialOpen(true);
    }
  }, [worldState?.trainer.id]);

  // Phaser → React event bridge
  useEffect(() => {
    const onZone = (e: Event) => {
      const detail = (e as CustomEvent).detail as { zoneName: string };
      setZoneName(detail.zoneName);
    };
    const onInteract = (e: Event) => {
      const detail = (e as CustomEvent).detail as InteractTarget;
      setInteract(detail);
    };
    const onPosition = (e: Event) => {
      const detail = (e as CustomEvent).detail as { x: number; y: number };
      // throttled position save
      void fetch("/api/world/position", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: detail.x, y: detail.y }),
      }).catch(() => undefined);
    };
    window.addEventListener("phaser:zone-changed", onZone);
    window.addEventListener("phaser:interact", onInteract);
    window.addEventListener("phaser:position", onPosition);
    return () => {
      window.removeEventListener("phaser:zone-changed", onZone);
      window.removeEventListener("phaser:interact", onInteract);
      window.removeEventListener("phaser:position", onPosition);
    };
  }, []);

  // Handle E-interactions
  useEffect(() => {
    if (!interact || busyRef.current) return;
    const target = interact;
    setInteract(null);
    if (target.kind === "monster") {
      void saveInteractionPosition(target)
        .then(() => startEncounter(target.id))
        .catch(() => window.dispatchEvent(new CustomEvent("world-toast", { detail: { message: "Could not verify your position. Try again." } })));
    } else if (target.kind === "shop") {
      setShopOpen(true);
    } else if (target.kind === "guide") {
      setGuideOpen(true);
    } else if (target.kind === "pickup") {
      void saveInteractionPosition(target)
        .then(() => claimPickup(target.id))
        .catch(() => window.dispatchEvent(new CustomEvent("world-toast", { detail: { message: "Could not verify your position. Try again." } })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interact]);

  async function saveInteractionPosition(target: InteractTarget) {
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) return;
    const res = await fetch("/api/world/position", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x: target.x, y: target.y }),
    });
    if (!res.ok) throw new Error("Could not save your current position.");
  }

  async function startEncounter(spawnId: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const res = await fetch("/api/world/encounter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spawnId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        console.error("encounter failed", data.error);
        return;
      }
      setEncounter(data);
    } finally {
      busyRef.current = false;
    }
  }

  async function claimPickup(pickupKey: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const res = await fetch("/api/world/pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickupKey }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        await refreshWorldState();
        window.dispatchEvent(
          new CustomEvent("world-toast", {
            detail: { message: data.message ?? "Pickup collected!" },
          }),
        );
      }
    } finally {
      busyRef.current = false;
    }
  }

  async function claimDailySupply() {
    if (dailyBusy || !worldState?.dailySupply.ready) return;
    setDailyBusy(true);
    try {
      const res = await fetch("/api/world/daily-supply", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        window.dispatchEvent(new CustomEvent("world-toast", { detail: { message: data.error ?? "Daily supply unavailable." } }));
        return;
      }
      await refreshWorldState();
      window.dispatchEvent(
        new CustomEvent("world-toast", { detail: { message: "Daily Supply claimed: Basic ×5, Great ×1" } }),
      );
    } finally {
      setDailyBusy(false);
    }
  }

  async function handleEncounterClosed(flee = false) {
    if (flee && encounter) {
      const res = await fetch("/api/world/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encounterId: encounter.encounterId }),
      });
      if (!res.ok) {
        window.dispatchEvent(new CustomEvent("world-toast", { detail: { message: "Could not leave this encounter. Try again." } }));
        return;
      }
      // Keep the current Phaser scene after a Run. Recreating it while the
      // trainer is still beside the same spawn would immediately re-trigger
      // the proximity encounter and make Run feel broken.
      setEncounter(null);
      return;
    }
    setEncounter(null);
    await refreshWorldState();
  }

  function closeTutorial() {
    const trainerId = worldState?.trainer.id;
    if (trainerId) {
      try {
        window.localStorage.setItem(`chainmon:world-tutorial:${trainerId}`, "seen");
      } catch {
        // The tutorial still closes when storage is unavailable.
      }
    }
    setTutorialOpen(false);
  }

  if (!worldState) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-950 p-6 text-center">
        <div className="max-w-sm rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
          <p className="text-sm font-semibold text-slate-100">
            {worldLoadError ? "World is temporarily unavailable." : "Loading your world..."}
          </p>
          {worldLoadError ? (
            <>
              <p className="mt-2 text-xs text-red-300">{worldLoadError}</p>
              <button
                type="button"
                onClick={() => void refreshWorldState().catch((error) => setWorldLoadError(error instanceof Error ? error.message : "World temporarily unavailable."))}
                className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400"
              >
                Retry
              </button>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      {/* Phaser canvas */}
      <div className="absolute inset-0">
        <PhaserGame key={worldRevision} worldState={worldState} onGameReady={onGameReady} />
      </div>

      {/* HUD */}
      <WorldHUD
        worldState={worldState}
        zoneName={zoneName}
        onClaimDaily={() => void claimDailySupply()}
        onOpenGuide={() => setGuideOpen(true)}
        onOpenMap={() => router.push("/world/select")}
        dailyBusy={dailyBusy}
      />

      {/* Overlays */}
      {encounter ? (
        <EncounterOverlay
          encounter={encounter}
          inventory={worldState.inventory}
          onClose={() => void handleEncounterClosed(true)}
          onCaptured={() => void handleEncounterClosed()}
        />
      ) : null}

      {shopOpen ? (
        <ShopOverlay
          gold={worldState.trainer.gold}
          onClose={() => {
            setShopOpen(false);
            void refreshWorldState();
          }}
        />
      ) : null}

      {guideOpen ? (
        <GuideOverlay onClose={() => setGuideOpen(false)} />
      ) : null}

      {tutorialOpen ? (
        <GuideOverlay variant="first-visit" onClose={closeTutorial} />
      ) : null}

      {/* bottom controls hint */}
      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-lg bg-slate-900/80 px-3 py-1 text-[11px] text-slate-300">
        WASD / Arrows Move · Touch WILD to Encounter · E Interact · ESC Close
      </div>
    </div>
  );
}
