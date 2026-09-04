"use client";

import Link from "next/link";
import type { RiftRunState } from "@/lib/rift/types";
import { getRiftConfig, getRiftEvent } from "@/lib/rift/config";
import { PixelMonster } from "../PixelMonster";
import { RiftIcon } from "./RiftIcon";

export function RiftSummary({ run, onNewRun }: { run: RiftRunState; onNewRun: () => void }) {
  const rift = getRiftConfig(run.riftId);
  const insights = run.eventDecisions.flatMap((decision) => {
    const event = getRiftEvent(decision.eventId);
    const choice = event?.choices.find((candidate) => candidate.id === decision.choiceId);
    return choice ? [choice.modifier.label] : [];
  });
  return (
    <section className="rift-panel rift-summary-stage animate-fade-in-up" data-rift={run.riftId} aria-labelledby="rift-summary-title">
      <div className="mx-auto max-w-3xl text-center">
        <div className="rift-summary-seal mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-emerald-300/40 bg-emerald-300/10 text-emerald-200">
          <RiftIcon type="rift" className="h-8 w-8" />
        </div>
        <p className="mt-6 font-mono text-xs uppercase tracking-[0.3em] text-emerald-300">Expedition complete</p>
        <h1 id="rift-summary-title" className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">{rift.summaryTitle}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-slate-400">
          The temporary route has closed. Battle rewards and captured creatures are now reflected in your collection; route modifiers have expired.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em]">
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-2.5 py-1 text-emerald-100">Core stabilized</span>
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-2.5 py-1 text-cyan-100">Collection updated</span>
          <span className="rounded-full border border-slate-700 bg-slate-950/45 px-2.5 py-1 text-slate-400">{rift.name}</span>
        </div>
      </div>

      <div className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Nodes", `${run.completedNodeIds.length} / 8`],
          ["Battles won", String(run.rewards.battlesWon)],
          ["Gold settled", `+${run.rewards.gold}`],
          ["EXP settled", `+${run.rewards.exp}`],
        ].map(([label, value]) => (
          <div key={label} className="rift-reward-card p-5 text-center" data-emphasis={label === "Gold settled" || label === "EXP settled"}>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
            <p className="mt-2 font-mono text-2xl font-bold text-slate-100">{value}</p>
          </div>
        ))}
      </div>

      {run.rewards.capture ? (
        <div className="rift-capture-reward mx-auto mt-4 flex max-w-4xl flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="rift-portrait-vault h-16 w-16 shrink-0 self-center sm:self-auto">
            <PixelMonster speciesId={run.rewards.capture.speciesId} variant="battle-front" alt={`${run.rewards.capture.monsterName} sprite`} className="h-16 w-16 p-1" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Collection synchronized</p>
            <p className="mt-2 text-xl font-bold text-slate-100">{run.rewards.capture.monsterName}</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">Added to your collection. No mint, approval or transaction was triggered.</p>
          </div>
          <span className="self-start rounded-full border border-cyan-300/20 bg-cyan-300/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100 sm:self-center">New signal</span>
        </div>
      ) : (
        <div className="mx-auto mt-4 max-w-4xl rounded-2xl border border-slate-800 bg-slate-950/45 p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">No new signal capture</p>
          <p className="mt-2 text-sm text-slate-400">The route is complete; no creature joined the collection this time.</p>
        </div>
      )}

      <div className="mx-auto mt-4 max-w-4xl border-t border-slate-800/80 pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-violet-200">Protocol insight gained</p>
            <p className="mt-1 text-sm text-slate-500">The route modifiers expire now, but their protocol decisions remain part of this run record.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {insights.length ? insights.map((insight) => (
              <span key={insight} className="rounded-full border border-violet-300/20 bg-violet-300/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-violet-100">{insight}</span>
            )) : <span className="rounded-full border border-slate-700 bg-slate-950/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">Route scan complete</span>}
          </div>
        </div>
      </div>

      <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/monsters" className="rift-button-secondary text-center">Open collection</Link>
        <button type="button" onClick={onNewRun} className="rift-button-primary">Start a new expedition</button>
      </div>
    </section>
  );
}
