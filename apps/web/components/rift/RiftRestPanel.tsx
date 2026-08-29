"use client";

import type { ActiveRiftModifier } from "@/lib/rift/types";
import { RiftIcon } from "./RiftIcon";

const REST_OPTIONS: Omit<ActiveRiftModifier, "sourceNodeId">[] = [
  {
    id: "reserve-shield",
    label: "Reserve Shield",
    description: "+2 Guard for the remaining expedition.",
    axis: "guard",
    amount: 2,
  },
  {
    id: "route-calibration",
    label: "Route Calibration",
    description: "+2 Signal for the remaining expedition.",
    axis: "signal",
    amount: 2,
  },
];

export function RiftRestPanel({
  onComplete,
}: {
  onComplete: (modifier: Omit<ActiveRiftModifier, "sourceNodeId">) => void;
}) {
  return (
    <section className="rift-panel animate-fade-in-up" aria-labelledby="rest-title">
      <div className="rift-kicker text-emerald-200"><RiftIcon type="rest" className="h-4 w-4" /> Reserve sanctum</div>
      <h1 id="rest-title" className="rift-title mt-3">Tune the expedition</h1>
      <p className="rift-copy mt-3 max-w-2xl">
        The sanctuary restores deployment readiness automatically. Choose one temporary protocol calibration before continuing.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {REST_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onComplete(option)}
            className="min-h-40 cursor-pointer rounded-2xl border border-slate-700 bg-slate-950/55 p-6 text-left transition duration-200 hover:border-emerald-300/60 hover:bg-emerald-300/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-300">+{option.amount} {option.axis}</span>
            <h2 className="mt-3 text-xl font-semibold text-slate-100">{option.label}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{option.description}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
