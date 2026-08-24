"use client";

interface GuideOverlayProps {
  onClose: () => void;
  dailyReady: boolean;
  dailyBusy: boolean;
  onClaimDaily: () => void;
}

/** Trainer Guide NPC — two short lines, no tutorial wall. */
export function GuideOverlay({ onClose, dailyReady, dailyBusy, onClaimDaily }: GuideOverlayProps) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <h2 className="text-lg font-bold text-white">Trainer Guide</h2>
        <p className="mt-2 text-sm text-slate-300">
          “Use WASD to explore. Wild ChainMon roam nearby.”
        </p>
        <p className="mt-2 text-sm text-slate-300">
          “Capture monsters, build a team, then claim your favorites on Monad.”
        </p>
        <div className="mt-3 rounded-lg bg-slate-800/60 p-2 text-xs text-slate-400">
          💡 Daily Supply box is here at camp · Ball Merchant buys your gold ·
          glowing sparks on the map are pickups.
        </div>
        <button
          type="button"
          disabled={!dailyReady || dailyBusy}
          onClick={onClaimDaily}
          className="mt-3 w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500"
        >
          {dailyBusy ? "Claiming supply..." : dailyReady ? "Claim Daily Supply · Basic ×5 + Great ×1" : "Daily Supply already claimed"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-600"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
