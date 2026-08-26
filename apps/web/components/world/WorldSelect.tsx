"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WORLD_MAPS, type WorldMapId } from "@/lib/world/world-maps";

const MAP_ICON: Record<WorldMapId, string> = {
  "whispering-forest": "🌲",
  "azure-lake": "🌊",
  "ember-volcano": "🌋",
  "power-station": "⚡",
};

interface WorldSelectProps {
  currentWorldMap: string;
}

/** Formal world entry: no random old Explore action and no client-selected spawn data. */
export function WorldSelect({ currentWorldMap }: WorldSelectProps) {
  const router = useRouter();
  const [entering, setEntering] = useState<WorldMapId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enterWorld(worldMap: WorldMapId) {
    setEntering(worldMap);
    setError(null);
    try {
      const response = await fetch("/api/world/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldMap }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not enter this world.");
      router.push("/world");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not enter this world.");
      setEntering(null);
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-300">ChainMon Pixel Worlds</p>
        <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">选择探索区域</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-300">
          每个区域都是独立 Phaser 世界。进入后从安全入口开始，移动位置会持续保存。
        </p>
      </div>

      {error ? (
        <p role="alert" className="mx-auto mb-5 max-w-xl rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-center text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        {WORLD_MAPS.map((map) => {
          const active = currentWorldMap === map.id;
          return (
            <article
              key={map.id}
              className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow-xl transition hover:-translate-y-0.5 hover:border-emerald-400/60"
            >
              <div className="flex items-start gap-4">
                <span aria-hidden className="text-4xl">{MAP_ICON[map.id]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-white">{map.chineseName}</h2>
                    <span className="rounded-full border border-slate-600 px-2 py-0.5 text-[11px] font-semibold text-slate-300">{map.element}</span>
                    {active ? <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-bold text-emerald-200">当前区域</span> : null}
                  </div>
                  <p className="mt-1 text-sm text-sky-300">{map.name}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{map.description}</p>
                  <p className="mt-3 text-xs text-slate-400">可能出现：{map.featuredSpecies.join(" · ")}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={entering !== null}
                onClick={() => void enterWorld(map.id)}
                className="mt-5 w-full rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-extrabold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-wait disabled:bg-slate-600 disabled:text-slate-300"
              >
                {entering === map.id ? "正在进入…" : `进入 ${map.chineseName}`}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
