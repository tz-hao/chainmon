"use client";

import Image from "next/image";
import type { RiftMonsterView } from "@/lib/rift/types";
import { RiftIcon } from "./RiftIcon";

interface RiftTeamSelectProps {
  monsters: RiftMonsterView[];
  portraits: Record<number, string>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function RiftTeamSelect({
  monsters,
  portraits,
  selectedIds,
  onChange,
  onBack,
  onContinue,
}: RiftTeamSelectProps) {
  function toggle(monsterId: string) {
    if (selectedIds.includes(monsterId)) {
      onChange(selectedIds.filter((id) => id !== monsterId));
      return;
    }
    if (selectedIds.length < 3) onChange([...selectedIds, monsterId]);
  }

  const selectedMonsters = selectedIds.map((id) => monsters.find((monster) => monster.id === id));

  return (
    <section className="rift-panel rift-stage animate-fade-in-up" aria-labelledby="rift-team-title">
      <div className="rift-kicker">
        <RiftIcon type="team" className="h-4 w-4" /> Deployment roster
      </div>
      <div className="mt-3 flex flex-col gap-4 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 id="rift-team-title" className="rift-title">Select your field team</h1>
          <p className="rift-copy mt-2 max-w-2xl">
            Build a one-to-three creature deployment line. Every slot is sourced from your server-backed collection; a full squad unlocks tactical switching.
          </p>
        </div>
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Deployment line</p>
          <p className="mt-1 font-mono text-xl font-bold text-cyan-200">{selectedIds.length} <span className="text-slate-600">/</span> 3</p>
        </div>
      </div>

      <div className="rift-team-layout mt-8">
        <div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-100/65">Available collection</p>
              <p className="mt-1 text-sm text-slate-400">Select a creature to assign it to the next open field slot.</p>
            </div>
            <span className="font-mono text-xs text-slate-500">{monsters.length} ready</span>
          </div>

          {monsters.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-10 text-center">
              <p className="font-semibold text-slate-200">No monsters are available for deployment.</p>
              <p className="mt-2 text-sm text-slate-400">Choose your starter before entering a protocol Rift.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {monsters.map((monster) => {
                const selected = selectedIds.includes(monster.id);
                const disabled = !selected && selectedIds.length >= 3;
                return (
                  <button
                    key={monster.id}
                    type="button"
                    aria-pressed={selected}
                    disabled={disabled}
                    onClick={() => toggle(monster.id)}
                    data-selected={selected}
                    className={`rift-monster-select-card group p-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                      disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer hover:-translate-y-0.5 hover:border-cyan-300/45"
                    }`}
                  >
                    <div className="flex h-full gap-4">
                      <div className="rift-portrait-vault h-24 w-24 shrink-0 sm:h-28 sm:w-28">
                        <Image
                          src={portraits[monster.speciesId] ?? "/monsters/placeholder.svg"}
                          alt={`${monster.name} portrait`}
                          fill
                          sizes="112px"
                          className="object-contain p-2 [image-rendering:pixelated]"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="truncate text-lg font-bold text-slate-100">{monster.name}</p>
                            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/75">Lv {monster.level} · {monster.element}</p>
                          </div>
                          <span className={`grid h-7 w-7 place-items-center rounded-full border text-xs transition ${selected ? "border-cyan-200 bg-cyan-200 text-slate-950" : "border-slate-700 bg-slate-950/70 text-slate-600"}`} aria-hidden="true">
                            {selected ? "✓" : ""}
                          </span>
                        </div>
                        <p className="mt-3 inline-flex rounded-full border border-violet-300/20 bg-violet-300/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200">{monster.rarity}</p>
                        <dl className="mt-3 grid grid-cols-4 gap-1 font-mono text-[10px] text-slate-400">
                          <div><dt className="text-slate-600">HP</dt><dd>{monster.hp}</dd></div>
                          <div><dt className="text-slate-600">ATK</dt><dd>{monster.attack}</dd></div>
                          <div><dt className="text-slate-600">DEF</dt><dd>{monster.defense}</dd></div>
                          <div><dt className="text-slate-600">SPD</dt><dd>{monster.speed}</dd></div>
                        </dl>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <aside className="rift-mission-card p-4 sm:p-5" aria-label="Field team slots">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-100/70">Field slots</p>
              <h2 className="mt-1 text-lg font-bold text-white">Squad formation</h2>
            </div>
            <RiftIcon type="team" className="h-6 w-6 text-cyan-200" />
          </div>
          <div className="mt-5 space-y-3">
            {[0, 1, 2].map((slot) => {
              const monster = selectedMonsters[slot];
              return (
                <div key={slot} className="rift-team-slot flex items-center gap-3 p-3" data-filled={Boolean(monster)}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-700 bg-slate-950/70 font-mono text-[10px] text-slate-500">0{slot + 1}</span>
                  {monster ? (
                    <>
                      <div className="rift-portrait-vault h-10 w-10 shrink-0 rounded-lg">
                        <Image src={portraits[monster.speciesId] ?? "/monsters/placeholder.svg"} alt="" fill sizes="40px" className="object-contain p-0.5 [image-rendering:pixelated]" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">{monster.name}</p>
                        <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-cyan-100/70">Active roster</p>
                      </div>
                    </>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-slate-400">Open deployment slot</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-600">Reserve ready</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-5 border-t border-slate-800/80 pt-4 text-xs leading-5 text-slate-500">More members create real switching options; empty slots remain visible so the squad structure is always clear.</p>
        </aside>
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onBack} className="rift-button-secondary">Back to hub</button>
        <button
          type="button"
          onClick={onContinue}
          disabled={selectedIds.length === 0}
          className="rift-button-primary"
        >
          Lock team and scan Rifts
        </button>
      </div>
    </section>
  );
}
