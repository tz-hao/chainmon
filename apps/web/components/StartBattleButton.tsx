"use client";

import { useState, useTransition } from "react";
import { startBattleAction } from "@/actions/battle";

export function StartBattleButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleStart() {
    setError(null);
    startTransition(async () => {
      const result = await startBattleAction();
      if (!result.ok && result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleStart}
        disabled={pending}
        className="w-full border border-amber-300 bg-amber-300 px-4 py-3 font-mono text-[11px] font-black uppercase tracking-[0.14em] text-slate-950 transition-colors hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Creating battle..." : "Start Battle"}
      </button>
      {error ? (
        <p className="mt-3 border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
