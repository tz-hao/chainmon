"use client";

import type { RiftEventChoice, RiftProtocolEvent } from "@/lib/rift/types";
import { RiftIcon } from "./RiftIcon";

function decisionCue(choice: RiftEventChoice): string {
  if (choice.modifier.axis === "guard") return "Safe · Guard";
  if (choice.modifier.axis === "tempo") return "Aggressive · Tempo";
  return "Utility · Signal";
}

export function RiftEventPanel({
  event,
  onChoose,
}: {
  event: RiftProtocolEvent;
  onChoose: (choice: RiftEventChoice) => void;
}) {
  return (
    <section className="rift-panel rift-stage animate-fade-in-up" data-rift={event.riftId} aria-labelledby="protocol-event-title">
      <div className="rift-kicker text-violet-200"><RiftIcon type="protocol-event" className="h-4 w-4" /> Protocol event · {event.protocol}</div>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rift-event-brief p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-violet-200/80">Live protocol condition</p>
              <h1 id="protocol-event-title" className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{event.title}</h1>
            </div>
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-violet-300/25 bg-violet-300/10 text-violet-200"><RiftIcon type="protocol-event" className="h-5 w-5" /></span>
          </div>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-200">{event.premise}</p>
          <div className="mt-8 border-y border-violet-300/15 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200">Protocol intelligence</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">{event.insight}</p>
          </div>
          <div className="mt-6 flex items-center gap-3 text-xs leading-5 text-slate-400">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-violet-300/20 bg-violet-300/5 text-violet-200"><RiftIcon type="signal" className="h-3.5 w-3.5" /></span>
            This decision affects the current expedition only. It never creates an on-chain transaction.
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Choose an expedition response</p>
              <p className="mt-1 text-sm text-slate-500">Read the tradeoff. Commit to the route.</p>
            </div>
            <span className="font-mono text-xs text-violet-200">01 / 01</span>
          </div>
          {event.choices.map((choice, index) => (
            <button
              key={choice.id}
              type="button"
              data-axis={choice.modifier.axis}
              onClick={() => onChoose(choice)}
              className="rift-decision-card group min-h-36 w-full cursor-pointer p-5 text-left transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3">
                  <span className="mt-0.5 font-mono text-xs text-slate-600">0{index + 1}</span>
                  <div>
                    <p className="text-base font-bold text-slate-100 transition group-hover:text-white">{choice.label}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{choice.detail}</p>
                  </div>
                </div>
                <span className="font-mono text-lg font-bold" style={{ color: "var(--rift-decision)" }}>+{choice.modifier.amount}</span>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="rift-decision-tag rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em]">{decisionCue(choice)}</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{choice.modifier.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
