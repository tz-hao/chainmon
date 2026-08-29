"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { getMonsterVisualPath } from "@/lib/world/monster-visuals";
import type { WorldStateResponse } from "@/lib/world/world-types";
import { getSpeciesById } from "@chainmon/monster-data";
import { NATIVE_CURRENCY_SYMBOL } from "@/lib/web3/chain";

export interface EncounterData {
  encounterId: string;
  speciesId: number;
  speciesName: string;
  element: string;
  rarity: string;
  level: number;
  currentHp: number;
  maxHp: number;
  catchChancePreview: number;
}

interface EncounterOverlayProps {
  encounter: EncounterData;
  inventory: WorldStateResponse["inventory"];
  onClose: () => void;
  onCaptured: () => void;
}

type ThrowState =
  | { phase: "idle" }
  | { phase: "throwing" }
  | { phase: "shaking"; shakes: number }
  | { phase: "caught" }
  | { phase: "broke-free" };

/**
 * In-world encounter overlay: large sprite, stats, catch chance preview,
 * capsule selector. Capture attempts keep the encounter alive on failure —
 * only Run ends it (per the upgraded capture loop).
 */
export function EncounterOverlay({ encounter, inventory, onClose, onCaptured }: EncounterOverlayProps) {
  const species = getSpeciesById(encounter.speciesId);
  const [ball, setBall] = useState("basic-ball");
  const [throwState, setThrowState] = useState<ThrowState>({ phase: "idle" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const isWeb3Creature = encounter.speciesId >= 21;

  async function throwBall() {
    if (busy || throwState.phase === "throwing") return;
    setBusy(true);
    setError(null);
    setMessage(null);
    setThrowState({ phase: "throwing" });
    try {
      const res = await fetch("/api/world/throw-ball", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encounterId: encounter.encounterId,
          ballSlug: ball,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Capture failed.");
        setThrowState({ phase: "idle" });
        return;
      }
      if (data.outcome === "captured") {
        // shake animation then success panel
        setThrowState({ phase: "shaking", shakes: 3 });
        timerRef.current = window.setTimeout(() => {
          setThrowState({ phase: "caught" });
          setMessage(
            isWeb3Creature
              ? `${encounter.speciesName} captured! Web3 Knowledge Unlocked.`
              : `${encounter.speciesName} captured!`,
          );
          window.dispatchEvent(new CustomEvent("world-toast", { detail: { message: "Monster added to your Collection!" } }));
        }, 1400);
      } else {
        setThrowState({ phase: "shaking", shakes: 1 });
        timerRef.current = window.setTimeout(() => {
          setThrowState({ phase: "broke-free" });
          setMessage(`${encounter.speciesName} broke free! It's still here — throw another capsule.`);
          timerRef.current = window.setTimeout(() => setThrowState({ phase: "idle" }), 1200);
        }, 700);
      }
    } catch {
      setError("Capture failed — try again.");
      setThrowState({ phase: "idle" });
    } finally {
      setBusy(false);
    }
  }

  const ballLabels: Record<string, string> = {
    "basic-ball": "Basic Capsule",
    "great-ball": "Great Capsule",
    "ultra-ball": "Ultra Capsule",
  };
  const ballCount = (slug: string) => inventory.find((item) => item.slug === slug)?.quantity ?? 0;
  const selectedBallCount = ballCount(ball);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{encounter.speciesName}</h2>
            <div className="mt-1 flex gap-2 text-xs">
              <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">
                {encounter.element}
              </span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-amber-300">
                {encounter.rarity}
              </span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">
                Lv {encounter.level}
              </span>
              {isWeb3Creature ? (
                <span className="rounded bg-purple-500/20 px-2 py-0.5 font-bold text-purple-300">
                  WEB3 CREATURE
                </span>
              ) : null}
            </div>
          </div>
          <div className="text-xs text-slate-400">
            HP {encounter.currentHp}/{encounter.maxHp}
          </div>
        </div>

        {/* Large monster sprite */}
        <div className="mt-4 flex justify-center">
          <div className="relative flex h-48 w-48 items-center justify-center rounded-xl bg-slate-800/60">
            {species ? (
              <Image
                src={getMonsterVisualPath(encounter.speciesId, "portrait")}
                alt={encounter.speciesName}
                width={160}
                height={160}
                unoptimized
                className={throwState.phase === "shaking" ? "animate-pulse" : ""}
              />
            ) : (
              <span className="text-slate-500">?</span>
            )}
            {throwState.phase === "caught" ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-black text-emerald-300">CAUGHT!</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Catch chance preview */}
        <div className="mt-3 text-center text-xs text-slate-400">
          Catch chance:{" "}
          <span className="font-bold text-sky-300">
            {(encounter.catchChancePreview * 100).toFixed(0)}%
          </span>{" "}
          (Basic / Great / Ultra capsules)
        </div>

        <p className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-center text-xs text-emerald-100">
          选择一种捕捉球，然后点击 <span className="font-bold">Throw Ball</span>。捕捉失败后可以继续投掷，Run 会结束本次遭遇。
        </p>

        {/* Ball selector */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(["basic-ball", "great-ball", "ultra-ball"] as const).map((slug) => (
            <button
              key={slug}
              type="button"
              disabled={busy || ballCount(slug) === 0}
              onClick={() => setBall(slug)}
              className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
                ball === slug
                  ? "border-amber-400 bg-amber-500/20 text-amber-200"
                  : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"
              } disabled:opacity-50`}
            >
              {ballLabels[slug]} ×{ballCount(slug)}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy || selectedBallCount === 0 || throwState.phase === "throwing" || throwState.phase === "caught"}
            onClick={() => void throwBall()}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            {throwState.phase === "throwing"
              ? "Throwing..."
              : busy
                ? "Throwing..."
                : "Throw Ball"}
          </button>
          {throwState.phase === "caught" ? (
            <button
              type="button"
              onClick={onCaptured}
              className="flex-1 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-500"
            >
              Back to World
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="flex-1 rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-600 disabled:opacity-50"
            >
              Run
            </button>
          )}
        </div>

        {message ? <p className="mt-3 text-center text-sm text-sky-300">{message}</p> : null}
        {error ? <p className="mt-3 text-center text-sm text-red-400">{error}</p> : null}
        <p className="mt-2 text-center text-[10px] text-slate-500">
          Native marketplace currency: {NATIVE_CURRENCY_SYMBOL} · capture resolves safely
        </p>
      </div>
    </div>
  );
}
