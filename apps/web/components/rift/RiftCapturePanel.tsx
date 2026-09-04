"use client";

import { useEffect, useMemo, useState } from "react";
import { CAPTURE_BALLS, calculateCaptureChance, type WildEncounter } from "@chainmon/game-engine";
import { getSpeciesById } from "@chainmon/monster-data";
import type { InventoryEntry } from "@/lib/data";
import type { RiftCaptureSummary, RiftId, RiftNode } from "@/lib/rift/types";
import { PixelMonster } from "../PixelMonster";
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

function VitalityBar({ current, max }: { current: number; max: number }) {
  const percentage = Math.max(0, Math.min(100, Math.round((current / Math.max(max, 1)) * 100)));
  const tone = percentage > 50 ? "bg-emerald-400" : percentage > 20 ? "bg-amber-300" : "bg-rose-400";
  return <div className="h-2 border border-slate-800 bg-[#050b17]"><div className={`h-full ${tone}`} style={{ width: `${percentage}%` }} /></div>;
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
        if (payload.encounter.status === "captured") setCaptured({ monsterId: "server-recorded", monsterName: payload.encounter.speciesName, speciesId: payload.encounter.speciesId });
      })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Encounter could not start."); })
      .finally(() => { if (!controller.signal.aborted) setPending(false); });
    return () => controller.abort();
  }, [node.id, onEncounterReady, riftId, seed]);

  const species = encounter ? getSpeciesById(encounter.speciesId) : undefined;
  const totalBalls = useMemo(() => CAPTURE_BALLS.reduce((total, ball) => total + (inventory.find((entry) => entry.slug === ball.slug)?.quantity ?? 0), 0), [inventory]);
  const lockPercent = encounter ? Math.round((1 - encounter.currentHp / encounter.maxHp) * 100) : 0;

  async function throwCapsule(ballSlug: string) {
    if (!encounter || pending || captured) return;
    setPending(true);
    setError(null);
    setSelectedBallSlug(ballSlug);
    setFeedback("Resolving capture roll…");
    try {
      const response = await fetch("/api/rift/encounter/throw", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ encounterId: encounter.id, ballSlug }) });
      const payload = (await response.json()) as ThrowPayload;
      if (!response.ok) throw new Error(payload.error ?? "Capture request failed.");
      setInventory(payload.inventory);
      if (payload.outcome === "captured" && payload.monster) {
        setCaptured({ monsterId: payload.monster.id, monsterName: payload.monster.name, speciesId: payload.monster.speciesId });
        setFeedback("Signal locked. Creature committed to your collection.");
      } else {
        setFeedback(`Signal escaped at ${Math.round(payload.chance * 100)}% lock probability. Try again.`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Capture could not be resolved.");
      setFeedback(null);
    } finally {
      setPending(false);
    }
  }

  if (!encounter || !species) {
    return <section className="grid min-h-[28rem] place-items-center border-2 border-slate-700 bg-[#07101f] text-center animate-fade-in-up"><div><div className="mx-auto grid h-12 w-12 place-items-center border-2 border-amber-300 bg-[#050b17] text-amber-200"><RiftIcon type="capsule" className="h-6 w-6" /></div><p className="mt-4 font-mono text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">Opening wild signal</p>{error ? <p role="alert" className="mt-3 text-xs text-rose-300">{error}</p> : null}</div></section>;
  }

  return (
    <div className="space-y-4 animate-fade-in-up" data-rift={riftId}>
      <section className="border-2 border-slate-700 bg-[#07101f]" aria-labelledby="rift-capture-title">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><div><p className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-amber-300">Rift capture · wild signal</p><h1 id="rift-capture-title" className="mt-1 font-mono text-lg font-black uppercase text-slate-100">{species.name}</h1></div><p className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-amber-200">Lv {encounter.level}</p></div>
        <div className="relative min-h-[29rem] overflow-hidden bg-[#050b17] sm:min-h-[16rem] lg:min-h-[31rem]">
          <div className="bg-grid absolute inset-0 opacity-30" aria-hidden="true" />
          <p className="absolute left-4 top-4 z-10 font-mono text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{riftId.replaceAll("-", " ")} · {species.element} · {species.rarity}</p>
          <div className="absolute left-1/2 top-[44%] z-10 -translate-x-1/2 -translate-y-1/2"><div className="lg:hidden"><PixelMonster speciesId={species.id} variant="battle-front" scale={2} alt={`${species.name} wild battle sprite`} priority className="h-32 w-32" /></div><div className="hidden lg:block"><PixelMonster speciesId={species.id} variant="battle-front" scale={3} alt={`${species.name} wild battle sprite`} priority className="h-48 w-48" /></div></div>
          <div className="absolute inset-x-4 bottom-4 z-10 border border-slate-700 bg-[#07101f] p-3 sm:inset-x-8 sm:bottom-6"><div className="flex items-center justify-between gap-3"><div><p className="font-mono text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Wild {species.name}</p><p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-300">HP {encounter.currentHp} / {encounter.maxHp}</p></div><p className="font-mono text-[10px] font-black uppercase text-amber-200">Signal {lockPercent}%</p></div><div className="mt-2"><VitalityBar current={encounter.currentHp} max={encounter.maxHp} /></div></div>
        </div>
      </section>

      {captured ? <section className="border-2 border-emerald-400/70 bg-emerald-400/5 p-5"><p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Capture confirmed</p><div className="mt-3 flex items-center gap-3"><PixelMonster speciesId={captured.speciesId} variant="battle-front" alt={`${captured.monsterName} captured`} className="h-16 w-16" priority /><div><h2 className="font-mono text-xl font-black uppercase text-slate-100">{captured.monsterName} joined</h2><p className="mt-1 text-xs text-slate-400">The creature is now in your collection. No wallet or token action was triggered.</p></div></div><button type="button" onClick={() => onCaptured(captured)} className="mt-5 border border-amber-300 bg-amber-300 px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-slate-950 transition-colors hover:bg-amber-200">Continue expedition</button></section> : <section className="border border-slate-700 bg-[#07101f]" aria-labelledby="rift-capsule-title"><div className="flex items-end justify-between border-b border-slate-800 px-4 py-3"><div><p className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Capture inventory</p><h2 id="rift-capsule-title" className="mt-1 font-mono text-sm font-black uppercase text-slate-100">Choose a capture ball</h2></div><p className="font-mono text-[9px] uppercase tracking-[0.1em] text-slate-500">{totalBalls} available</p></div><div className="grid gap-2 p-4 sm:grid-cols-3">{CAPTURE_BALLS.map((ball) => { const quantity = inventory.find((entry) => entry.slug === ball.slug)?.quantity ?? 0; const chance = Math.round(calculateCaptureChance({ catchRate: species.catchRate, currentHp: encounter.currentHp, maxHp: encounter.maxHp, ballModifier: ball.modifier }) * 100); const tone = ball.slug === "basic-ball" ? "border-rose-300/70 text-rose-200" : ball.slug === "great-ball" ? "border-sky-300/70 text-sky-200" : "border-violet-300/70 text-violet-200"; return <button key={ball.slug} type="button" disabled={pending || quantity <= 0} onClick={() => void throwCapsule(ball.slug)} data-selected={selectedBallSlug === ball.slug} className={`min-h-32 border bg-[#050b17] p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${pending || quantity <= 0 ? "cursor-not-allowed border-slate-800 opacity-40" : `${tone} hover:bg-slate-900`}`}><span className={`grid h-8 w-8 place-items-center border ${tone}`}><RiftIcon type="capsule" className="h-5 w-5" /></span><p className="mt-3 font-mono text-xs font-black uppercase text-slate-100">{ball.name}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-slate-500">{chance}% lock · ×{quantity}</p></button>; })}</div>{feedback ? <p aria-live="polite" className="border-t border-slate-800 px-4 py-3 text-xs text-amber-100">{feedback}</p> : null}{error ? <p role="alert" className="border-t border-rose-400/40 px-4 py-3 text-xs text-rose-200">{error}</p> : null}</section>}
    </div>
  );
}
