"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CAPTURE_BALLS, calculateCaptureChance, type WildEncounter } from "@chainmon/game-engine";
import type { MonsterSpeciesData } from "@chainmon/monster-data";
import type { Monster } from "@chainmon/shared";
import type { InventoryEntry } from "@/lib/data";
import { fleeAction, throwBallAction, type ThrowBallActionResult } from "@/actions/capture";
import { PixelMonster } from "./PixelMonster";
import { RiftIcon } from "./rift/RiftIcon";

type Phase = "idle" | "throwing" | "shaking" | "result";

interface EncounterPanelProps {
  encounter: WildEncounter;
  species: MonsterSpeciesData | undefined;
  inventory: InventoryEntry[];
}

function VitalityBar({ current, max }: { current: number; max: number }) {
  const percentage = Math.max(0, Math.min(100, Math.round((current / Math.max(max, 1)) * 100)));
  const tone = percentage > 50 ? "bg-emerald-400" : percentage > 20 ? "bg-amber-300" : "bg-rose-400";
  return <div className="h-2 border border-slate-800 bg-[#050b17]"><div className={`h-full ${tone}`} style={{ width: `${percentage}%` }} /></div>;
}

function CapturedCard({ monster }: { monster: Monster }) {
  return (
    <section className="animate-float-up border-2 border-emerald-400/70 bg-emerald-400/5 p-5 text-center">
      <PixelMonster speciesId={monster.speciesId} variant="battle-front" alt={`${monster.name} captured`} className="mx-auto h-16 w-16" priority />
      <p className="mt-3 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Capture confirmed</p>
      <h2 className="mt-1 font-mono text-2xl font-black uppercase text-slate-100">{monster.name} captured</h2>
      <p className="mt-2 text-xs text-slate-400">The creature joined your collection with its server-recorded traits.</p>
      <div className="mx-auto mt-4 grid max-w-md grid-cols-4 divide-x divide-slate-800 border border-slate-700 bg-[#050b17] font-mono text-xs"><div className="p-2"><span className="block text-[9px] text-slate-500">HP</span><span className="text-emerald-300">{monster.hp}</span></div><div className="p-2"><span className="block text-[9px] text-slate-500">ATK</span><span className="text-amber-200">{monster.attack}</span></div><div className="p-2"><span className="block text-[9px] text-slate-500">DEF</span><span className="text-sky-200">{monster.defense}</span></div><div className="p-2"><span className="block text-[9px] text-slate-500">SPD</span><span className="text-violet-200">{monster.speed}</span></div></div>
      <div className="mt-5 flex flex-wrap justify-center gap-2"><Link href={`/monsters/${monster.id}`} className="border border-amber-300 bg-amber-300 px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-slate-950 transition-colors hover:bg-amber-200">View monster</Link><Link href="/explore" className="border border-slate-600 bg-[#050b17] px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-slate-300 transition-colors hover:border-amber-300 hover:text-amber-100">Back to explore</Link></div>
    </section>
  );
}

export function EncounterPanel({ encounter, species, inventory }: EncounterPanelProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ThrowBallActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const captured = result?.ok && result.result?.outcome === "captured" ? result.result.monster : null;
  const failed = result?.ok && result.result?.outcome === "failed";
  const basicBall = CAPTURE_BALLS[0];
  const baseChance = species && basicBall ? Math.round(calculateCaptureChance({ catchRate: species.catchRate, currentHp: encounter.currentHp, maxHp: encounter.maxHp, ballModifier: basicBall.modifier }) * 100) : 0;

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
        if (response.ok && response.result?.outcome === "failed") router.refresh();
      }, 1600);
    });
  }

  function handleFlee() {
    if (pending) return;
    const formData = new FormData();
    formData.set("encounterId", encounter.id);
    startTransition(async () => { await fleeAction(formData); });
  }

  return (
    <div className="space-y-4">
      <section className="border-2 border-slate-700 bg-[#07101f]" aria-labelledby="encounter-title">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><div><p className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-amber-300">Wild encounter // capture active</p><h1 id="encounter-title" className="mt-1 font-mono text-lg font-black uppercase text-slate-100">{encounter.speciesName}</h1></div><p className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-amber-200">Lv {encounter.level}</p></div>
        <div className="relative min-h-[29rem] overflow-hidden bg-[#050b17] sm:min-h-[16rem] lg:min-h-[31rem]">
          <div className="bg-grid absolute inset-0 opacity-30" aria-hidden="true" />
          <p className="absolute left-4 top-4 z-10 font-mono text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">WILD SIGNAL // {encounter.element} · {encounter.rarity}</p>
          {species ? <div className="absolute left-1/2 top-[44%] z-10 -translate-x-1/2 -translate-y-1/2"><div className="lg:hidden"><PixelMonster speciesId={species.id} variant="battle-front" scale={2} alt={`${encounter.speciesName} wild battle sprite`} priority className="h-32 w-32" /></div><div className="hidden lg:block"><PixelMonster speciesId={species.id} variant="battle-front" scale={3} alt={`${encounter.speciesName} wild battle sprite`} priority className="h-48 w-48" /></div></div> : null}
          <div className="absolute inset-x-4 bottom-4 z-10 border border-slate-700 bg-[#07101f] p-3 sm:inset-x-8 sm:bottom-6">
            <div className="flex items-center justify-between gap-3"><div><p className="font-mono text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Wild {encounter.speciesName}</p><p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-300">HP {encounter.currentHp} / {encounter.maxHp}</p></div><p className="font-mono text-[10px] font-black uppercase text-amber-200">Base lock {baseChance}%</p></div>
            <div className="mt-2"><VitalityBar current={encounter.currentHp} max={encounter.maxHp} /></div>
          </div>
        </div>
      </section>

      {captured ? <CapturedCard monster={captured} /> : <section className="border border-slate-700 bg-[#07101f]" aria-labelledby="capture-inventory-title">
        <div className="flex items-end justify-between border-b border-slate-800 px-4 py-3"><div><p className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Capture inventory</p><h2 id="capture-inventory-title" className="mt-1 font-mono text-sm font-black uppercase text-slate-100">Choose a capture ball</h2></div><p className="font-mono text-[9px] uppercase tracking-[0.1em] text-slate-500">Base chance {baseChance}%</p></div>
        {phase === "idle" || phase === "result" ? <><div className="grid gap-2 p-4 sm:grid-cols-3">{CAPTURE_BALLS.map((ball) => { const quantity = inventory.find((entry) => entry.slug === ball.slug)?.quantity ?? 0; const disabled = quantity <= 0 || pending; const chance = species ? Math.round(calculateCaptureChance({ catchRate: species.catchRate, currentHp: encounter.currentHp, maxHp: encounter.maxHp, ballModifier: ball.modifier }) * 100) : 0; const tone = ball.slug === "basic-ball" ? "border-rose-300/70 text-rose-200" : ball.slug === "great-ball" ? "border-sky-300/70 text-sky-200" : "border-violet-300/70 text-violet-200"; return <button key={ball.slug} type="button" disabled={disabled} onClick={() => handleThrow(ball.slug)} className={`min-h-32 border bg-[#050b17] p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${disabled ? "cursor-not-allowed border-slate-800 opacity-40" : `${tone} hover:bg-slate-900`}`}><span className={`grid h-8 w-8 place-items-center border ${tone}`}><RiftIcon type="capsule" className="h-5 w-5" /></span><p className="mt-3 font-mono text-xs font-black uppercase text-slate-100">{ball.name}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-slate-500">{chance}% lock · ×{quantity}</p></button>; })}</div><div className="flex items-center justify-between border-t border-slate-800 px-4 py-3"><button type="button" onClick={handleFlee} disabled={pending} className="border border-slate-600 bg-[#050b17] px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-slate-300 transition-colors hover:border-amber-300 hover:text-amber-100 disabled:opacity-40">Run away</button>{phase === "result" && failed ? <p className="font-mono text-[10px] font-black uppercase text-rose-300">Capture failed // signal escaped</p> : null}</div></> : <div className="grid min-h-52 place-items-center p-5 text-center"><div><div className={`mx-auto grid h-16 w-16 place-items-center border-2 border-amber-300 bg-[#050b17] text-amber-200 ${phase === "shaking" ? "animate-ball-shake" : ""}`}><RiftIcon type="capsule" className="h-8 w-8" /></div><p className="mt-4 font-mono text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">{phase === "throwing" ? "Capsule deployed" : "Capture roll resolving"}</p></div></div>}
      </section>}
      {error ? <p role="alert" className="border border-rose-400/50 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</p> : null}
    </div>
  );
}
