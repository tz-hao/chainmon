"use client";

import type { WorldStateResponse } from "@/lib/world/world-types";

interface WorldHUDProps {
  worldState: WorldStateResponse;
  zoneName: string;
  onClaimDaily: () => void;
  dailyBusy: boolean;
}

/** Top HUD: trainer, zone, gold, ball counts + network badge. */
export function WorldHUD({ worldState, zoneName, onClaimDaily, dailyBusy }: WorldHUDProps) {
  const ball = (slug: string) =>
    worldState.inventory.find((i) => i.slug === slug)?.quantity ?? 0;

  return (
    <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-start justify-between p-3">
      <div className="rounded-lg bg-slate-900/80 px-3 py-2 text-xs text-slate-200 backdrop-blur">
        <div className="font-bold">{worldState.trainer.nickname}</div>
        <div className="text-emerald-300">{zoneName}</div>
        <div className="mt-1 flex gap-2 text-slate-300">
          <span>🪙 {worldState.trainer.gold}</span>
          <span>◐ Basic ×{ball("basic-ball")}</span>
          <span>◑ Great ×{ball("great-ball")}</span>
          <span>◉ Ultra ×{ball("ultra-ball")}</span>
        </div>
        <button
          type="button"
          disabled={!worldState.dailySupply.ready || dailyBusy}
          onClick={onClaimDaily}
          className="pointer-events-auto mt-2 rounded border border-amber-400/50 bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/25 disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
        >
          {dailyBusy ? "Claiming..." : worldState.dailySupply.ready ? "Daily Supply: Claim Basic ×5 · Great ×1" : "Daily Supply claimed"}
        </button>
      </div>
      <div className="rounded-lg bg-slate-900/80 px-3 py-2 text-right text-xs backdrop-blur">
        <div className="font-semibold text-purple-300">Monad Testnet</div>
        <div className="text-slate-400">Chain ID 10143</div>
      </div>
    </div>
  );
}
