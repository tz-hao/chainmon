"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  CAPTURE_BALLS,
  calculateCaptureChance,
  type WildEncounter,
} from "@chainmon/game-engine";
import { getSpeciesById } from "@chainmon/monster-data";
import type { InventoryEntry } from "@/lib/data";
import type { RiftCaptureSummary, RiftId, RiftNode } from "@/lib/rift/types";
import { getMonsterVisualPath } from "@/lib/world/monster-visuals";
import { RiftIcon } from "./RiftIcon";

interface EncounterPayload {
  encounter: WildEncounter;
  inventory: InventoryEntry[];
  error?: string;
}

interface ThrowPayload {
  outcome: "captured" | "failed";
  chance: number;
  monster: { id: string; name: string; speciesId: number } | null;
  inventory: InventoryEntry[];
  error?: string;
}

export function RiftCapturePanel({
  riftId,
  seed,
  node,
  initialInventory,
  onEncounterReady,
  onCaptured,
}: {
  riftId: RiftId;
  seed: string;
  node: RiftNode;
  initialInventory: InventoryEntry[];
  onEncounterReady: (encounterId: string) => void;
  onCaptured: (capture: RiftCaptureSummary) => void;
}) {
  const [encounter, setEncounter] = useState<WildEncounter | null>(null);
  const [inventory, setInventory] = useState(initialInventory);
  const [captured, setCaptured] = useState<RiftCaptureSummary | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedBallSlug, setSelectedBallSlug] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setPending(true);
    void fetch("/api/rift/encounter", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ riftId, seed, nodeId: node.id }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as EncounterPayload;
        if (!response.ok) throw new Error(payload.error ?? "Encounter request failed.");
        return payload;
      })
      .then((payload) => {
        setEncounter(payload.encounter);
        setInventory(payload.inventory);
        onEncounterReady(payload.encounter.id);
        if (payload.encounter.status === "captured") {
          setCaptured({
            monsterId: "server-recorded",
            monsterName: payload.encounter.speciesName,
            speciesId: payload.encounter.speciesId,
          });
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Encounter could not start.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(false);
      });
    return () => controller.abort();
  }, [node.id, onEncounterReady, riftId, seed]);

  const species = encounter ? getSpeciesById(encounter.speciesId) : undefined;
  const totalCapsules = useMemo(
    () => CAPTURE_BALLS.reduce((total, ball) => total + (inventory.find((entry) => entry.slug === ball.slug)?.quantity ?? 0), 0),
    [inventory],
  );

  async function throwCapsule(ballSlug: string) {
    if (!encounter || pending || captured) return;
    setPending(true);
    setError(null);
    setSelectedBallSlug(ballSlug);
    setFeedback("Synchronizing capture roll…");
    try {
      const response = await fetch("/api/rift/encounter/throw", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ encounterId: encounter.id, ballSlug }),
      });
      const payload = (await response.json()) as ThrowPayload;
      if (!response.ok) throw new Error(payload.error ?? "Capture request failed.");
      setInventory(payload.inventory);
      if (payload.outcome === "captured" && payload.monster) {
        setCaptured({
          monsterId: payload.monster.id,
          monsterName: payload.monster.name,
          speciesId: payload.monster.speciesId,
        });
        setFeedback("Signal locked. Creature committed to your collection.");
      } else {
        setFeedback(`Signal escaped the capsule at ${Math.round(payload.chance * 100)}% lock probability. Try again.`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Capture could not be resolved.");
      setFeedback(null);
    } finally {
      setPending(false);
    }
  }

  if (!encounter || !species) {
    return (
      <section className="rift-panel min-h-[420px] animate-fade-in-up">
        <div className="rift-kicker text-cyan-200"><RiftIcon type="capture" className="h-4 w-4" /> Capture signal</div>
        <div className="grid min-h-72 place-items-center text-center">
          <div>
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-300" />
            <p className="mt-4 text-sm text-slate-400">Opening the encounter signal…</p>
            {error ? <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p> : null}
          </div>
        </div>
      </section>
    );
  }

  const signalPercent = Math.round((1 - encounter.currentHp / encounter.maxHp) * 100);

  return (
    <section className="rift-panel rift-stage animate-fade-in-up" data-rift={riftId} aria-labelledby="rift-capture-title">
      <div className="rift-kicker text-cyan-200"><RiftIcon type="capture" className="h-4 w-4" /> Capture signal</div>
      <div className="mt-6 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="rift-capture-stage relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-[1.75rem] border border-cyan-300/25">
          <div className="rift-map-grid absolute inset-0 opacity-45" />
          <div className="absolute left-5 top-5 rounded-full border border-cyan-300/20 bg-slate-950/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.17em] text-cyan-100/80">Target acquired</div>
          <div className="absolute bottom-5 left-5 rounded-full border border-emerald-300/20 bg-slate-950/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.17em] text-emerald-100/80">{species.rarity} signal</div>
          <div className="rift-capture-ring absolute inset-[13%] rounded-full" style={{ background: `conic-gradient(rgb(103 232 249) ${signalPercent}%, rgb(51 65 85 / 0.3) 0)` }} aria-hidden="true" />
          <div className="rift-portrait-vault absolute inset-[22%] rounded-full">
            <Image src={getMonsterVisualPath(species.id, "portrait")} alt={`${species.name} protocol creature portrait`} fill sizes="(max-width: 768px) 70vw, 224px" className="object-contain p-7 [image-rendering:pixelated]" priority />
          </div>
          <div className="rift-capture-target absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-[5.1rem]" aria-hidden="true">
            <Image src={getMonsterVisualPath(species.id, "portrait")} alt="" fill sizes="52px" className="object-contain p-1 [image-rendering:pixelated]" />
          </div>
          <div className="absolute bottom-[14%] left-1/2 -translate-x-1/2 rounded-full border border-cyan-300/25 bg-slate-950/75 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100">Lock {signalPercent}%</div>
        </div>
        <div>
          <div className="grid grid-cols-3 gap-2 text-center font-mono text-[10px] uppercase tracking-[0.13em] text-slate-600" aria-label="Capture phase">
            <span className="rift-capture-phase pb-2" data-active="true">01 Acquire</span>
            <span className="rift-capture-phase pb-2" data-active={Boolean(selectedBallSlug)}>02 Lock</span>
            <span className="rift-capture-phase pb-2" data-active={Boolean(captured)}>03 Commit</span>
          </div>
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.25em] text-cyan-300">Signal lock {signalPercent}%</p>
          <h1 id="rift-capture-title" className="mt-3 text-4xl font-bold tracking-tight text-white">{species.name}</h1>
          <p className="mt-2 text-sm uppercase tracking-[0.16em] text-slate-500">{species.element} · {species.rarity} · Rift encounter</p>
          <p className="mt-5 text-sm leading-6 text-slate-300">{species.description}</p>
          <div className="mt-6 flex items-center gap-3" aria-label={`${signalPercent}% signal lock`}>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full border border-white/5 bg-slate-950/80">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-300 shadow-[0_0_14px_rgba(34,211,238,0.7)] transition-[width] duration-300" style={{ width: `${signalPercent}%` }} />
            </div>
            <span className="font-mono text-xs font-bold text-cyan-100">{signalPercent}%</span>
          </div>

          {captured ? (
            <div className="rift-capture-reward mt-7 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-300/30 bg-emerald-300/10 text-emerald-200"><RiftIcon type="capture" className="h-5 w-5" /></span>
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-300">Capture complete</p>
                  <p className="mt-2 text-xl font-bold text-white">{captured.monsterName} joined your collection.</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">The creature is now in your collection. No NFT mint, approval or transaction was triggered.</p>
                </div>
              </div>
              <button type="button" onClick={() => onCaptured(captured)} className="rift-button-primary mt-5">Continue expedition</button>
            </div>
          ) : (
            <div className="mt-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Choose a capture capsule</p>
                  <p className="mt-1 text-xs text-slate-500">A capsule is consumed only when the capture roll resolves.</p>
                </div>
                <p className="font-mono text-xs text-slate-500">{totalCapsules} available</p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {CAPTURE_BALLS.map((ball) => {
                  const quantity = inventory.find((entry) => entry.slug === ball.slug)?.quantity ?? 0;
                  const chance = calculateCaptureChance({ catchRate: species.catchRate, currentHp: encounter.currentHp, maxHp: encounter.maxHp, ballModifier: ball.modifier });
                  return (
                    <button
                      key={ball.slug}
                      type="button"
                      disabled={pending || quantity <= 0}
                      onClick={() => void throwCapsule(ball.slug)}
                      data-selected={selectedBallSlug === ball.slug}
                      className="rift-capsule-card min-h-32 cursor-pointer rounded-2xl border border-slate-700 bg-slate-950/60 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/60 hover:bg-cyan-300/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <RiftIcon type="capsule" className="h-6 w-6 text-cyan-200" />
                      <p className="mt-3 text-sm font-semibold text-slate-100">{ball.name}</p>
                      <p className="mt-1 font-mono text-[10px] text-slate-500">{Math.round(chance * 100)}% · ×{quantity}</p>
                    </button>
                  );
                })}
              </div>
              {feedback ? <p aria-live="polite" className="mt-4 text-sm text-cyan-200">{feedback}</p> : null}
              {error ? <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p> : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
