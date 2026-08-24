"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CAPTURE_BALLS, type WildEncounter } from "@chainmon/game-engine";
import type { MonsterSpeciesData } from "@chainmon/monster-data";
import type { Monster } from "@chainmon/shared";
import type { InventoryEntry } from "@/lib/data";
import {
  fleeAction,
  throwBallAction,
  type ThrowBallActionResult,
} from "@/actions/capture";
import { ElementBadge } from "./ElementBadge";
import { RarityBadge } from "./RarityBadge";
import { getMonsterVisualPath } from "@/lib/world/monster-visuals";

type Phase = "idle" | "throwing" | "shaking" | "result";

interface EncounterPanelProps {
  encounter: WildEncounter;
  species: MonsterSpeciesData | undefined;
  inventory: InventoryEntry[];
}

function CapturedCard({ monster }: { monster: Monster }) {
  return (
    <div className="animate-float-up rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
      <div className="text-5xl">🎉</div>
      <h2 className="mt-3 text-2xl font-bold text-emerald-300">
        Monster Captured!
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        {monster.name} joined your collection with unique DNA.
      </p>
      <div className="mx-auto mt-5 max-w-xs rounded-xl bg-slate-950/50 p-4 text-left">
        <p className="text-lg font-bold text-slate-100">{monster.name}</p>
        <div className="mt-1 flex gap-1.5">
          <ElementBadge element={monster.element} />
          <RarityBadge rarity={monster.rarity} />
        </div>
        <dl className="mt-3 grid grid-cols-4 gap-1 text-center text-sm">
          <div>
            <dt className="text-[10px] uppercase text-slate-500">HP</dt>
            <dd className="font-semibold text-emerald-300">{monster.hp}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-slate-500">ATK</dt>
            <dd className="font-semibold text-red-300">{monster.attack}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-slate-500">DEF</dt>
            <dd className="font-semibold text-sky-300">{monster.defense}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-slate-500">SPD</dt>
            <dd className="font-semibold text-yellow-300">{monster.speed}</dd>
          </div>
        </dl>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href={`/monsters/${monster.id}`}
          className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
        >
          View Monster
        </Link>
        <Link
          href="/explore"
          className="rounded-lg border border-slate-700 bg-slate-800/60 px-5 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800"
        >
          Back to Explore
        </Link>
      </div>
    </div>
  );
}

export function EncounterPanel({
  encounter,
  species,
  inventory,
}: EncounterPanelProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ThrowBallActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleThrow(ballSlug: string) {
    if (pending) return;
    setError(null);
    setResult(null);
    setPhase("throwing");

    const formData = new FormData();
    formData.set("encounterId", encounter.id);
    formData.set("ballSlug", ballSlug);

    startTransition(async () => {
      const response = await throwBallAction(formData);
      setPhase("shaking");
      window.setTimeout(() => {
        setPhase("result");
        setResult(response);
        if (response.ok && response.result?.outcome === "failed") {
          // Refresh server props so remaining ball counts stay accurate.
          router.refresh();
        }
      }, 1600);
    });
  }

  function handleFlee() {
    if (pending) return;
    const formData = new FormData();
    formData.set("encounterId", encounter.id);
    startTransition(async () => {
      await fleeAction(formData);
    });
  }

  const captured =
    result?.ok && result.result?.outcome === "captured"
      ? result.result.monster
      : null;
  const failed = result?.ok && result.result?.outcome === "failed";

  return (
    <div className="space-y-6">
      {/* Wild monster card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">
          A Wild Monster Appeared!
        </p>
        <img
          src={species ? getMonsterVisualPath(species.id, "portrait") : "/monsters/placeholder.svg"}
          alt={encounter.speciesName}
          width={160}
          height={160}
          className="mx-auto mt-4 h-40 w-40 rounded-2xl bg-slate-950/40 object-cover"
        />
        <h1 className="mt-4 text-2xl font-bold text-slate-100">
          {encounter.speciesName}
        </h1>
        <div className="mt-2 flex justify-center gap-1.5">
          <ElementBadge element={encounter.element} />
          <RarityBadge rarity={encounter.rarity} />
          <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/30">
            Lv {encounter.level}
          </span>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          HP {encounter.currentHp} / {encounter.maxHp}
        </p>
      </div>

      {/* Throw / animation zone */}
      {captured ? (
        <CapturedCard monster={captured} />
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          {phase === "idle" || phase === "result" ? (
            <>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Choose a Capture Ball
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {CAPTURE_BALLS.map((ball) => {
                  const entry = inventory.find((i) => i.slug === ball.slug);
                  const quantity = entry?.quantity ?? 0;
                  const disabled = quantity <= 0 || pending;
                  return (
                    <button
                      key={ball.slug}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleThrow(ball.slug)}
                      className={`rounded-xl border px-4 py-4 text-center transition-colors ${
                        disabled
                          ? "cursor-not-allowed border-slate-800 bg-slate-950/60 opacity-50"
                          : "border-slate-700 bg-slate-800/60 hover:border-amber-500/50 hover:bg-slate-800"
                      }`}
                    >
                      <span className="text-2xl">
                        {ball.slug === "basic-ball"
                          ? "🔴"
                          : ball.slug === "great-ball"
                            ? "🔵"
                            : "🟣"}
                      </span>
                      <p className="mt-1 text-sm font-semibold text-slate-200">
                        {ball.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {ball.modifier.toFixed(2)}x · × {quantity}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleFlee}
                  disabled={pending}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 disabled:opacity-50"
                >
                  Run Away
                </button>
                {phase === "result" ? (
                  <p
                    className={`text-sm font-semibold ${
                      failed ? "text-red-300" : "text-slate-400"
                    }`}
                  >
                    {failed ? "Capture Failed! The ball broke." : ""}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <div className="py-10 text-center">
              <div
                className={`mx-auto h-20 w-20 rounded-full bg-gradient-to-br from-red-500 to-red-700 ring-4 ring-slate-700 ${
                  phase === "shaking" ? "animate-ball-shake" : ""
                }`}
              >
                <div className="mx-auto mt-8 h-2 w-12 rounded-full bg-slate-950" />
              </div>
              <p className="mt-6 text-sm font-semibold text-slate-300">
                {phase === "throwing" ? "Throwing..." : "Shake! Shake! Shake!"}
              </p>
            </div>
          )}
        </div>
      )}

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
