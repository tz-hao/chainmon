"use client";

import type { RiftMonsterView } from "@/lib/rift/types";
import { PixelMonster } from "../PixelMonster";

interface RiftTeamSelectProps {
  monsters: RiftMonsterView[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function RiftTeamSelect({
  monsters,
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
    <section className="border-2 border-slate-700 bg-[#07101f] animate-fade-in-up" aria-labelledby="rift-team-title">
      <div className="flex flex-col gap-4 border-b border-slate-800 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">Protocol Rift // deployment</p>
          <h1 id="rift-team-title" className="mt-1 font-mono text-2xl font-black uppercase tracking-[0.04em] text-slate-100">Lock field team</h1>
          <p className="mt-2 text-xs leading-5 text-slate-400">Choose one to three canonical creatures for this temporary route.</p>
        </div>
        <p className="border border-slate-700 bg-[#050b17] px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-slate-300"><span className="text-amber-200">{selectedIds.length}</span> / 3 selected</p>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_18rem] sm:p-5">
        <div>
          <div className="flex items-end justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <p className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Collection roster</p>
              <p className="mt-1 text-xs text-slate-400">Choose an available creature to add or remove it.</p>
            </div>
            <p className="font-mono text-[9px] uppercase text-slate-500">{monsters.length} ready</p>
          </div>
          {monsters.length === 0 ? (
            <div className="mt-3 border border-dashed border-slate-700 bg-[#050b17] p-6 text-center text-sm text-slate-400">No monsters are available for deployment.</div>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
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
                    className={`border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${selected ? "border-amber-300 bg-amber-300/10" : "border-slate-700 bg-[#050b17] hover:border-slate-500"} ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
                  >
                    <div className="flex items-start gap-2">
                      <PixelMonster speciesId={monster.speciesId} variant="battle-front" alt={`${monster.name} battle sprite`} className="h-16 w-16" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-sm font-black uppercase text-slate-100">{monster.name}</p>
                        <p className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">Lv {monster.level} · {monster.element}</p>
                        <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.08em] text-slate-500">{selected ? "Assigned" : monster.rarity}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <aside className="border border-slate-700 bg-[#050b17]" aria-label="Field team slots">
          <div className="border-b border-slate-800 px-3 py-3">
            <p className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Field slots</p>
            <h2 className="mt-1 font-mono text-sm font-black uppercase text-slate-100">Squad formation</h2>
          </div>
          <div className="divide-y divide-slate-800">
            {[0, 1, 2].map((slot) => {
              const monster = selectedMonsters[slot];
              return (
                <div key={slot} className="flex min-h-20 items-center gap-3 px-3 py-3" data-filled={Boolean(monster)}>
                  <span className="border border-slate-700 bg-[#07101f] px-2 py-1 font-mono text-[10px] font-black text-slate-500">0{slot + 1}</span>
                  {monster ? (
                    <>
                      <PixelMonster speciesId={monster.speciesId} variant="overworld" alt="" decorative className="h-10 w-10" />
                      <div className="min-w-0"><p className="truncate font-mono text-sm font-black uppercase text-slate-100">{monster.name}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-amber-200">Active roster</p></div>
                    </>
                  ) : (
                    <div><p className="font-mono text-xs font-bold uppercase text-slate-500">Open slot</p><p className="mt-1 text-[10px] text-slate-600">Reserve ready</p></div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <button type="button" onClick={onBack} className="border border-slate-600 bg-[#050b17] px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.12em] text-slate-300 transition-colors hover:border-amber-300 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">Back to hub</button>
        <button type="button" onClick={onContinue} disabled={selectedIds.length === 0} className="border border-amber-300 bg-amber-300 px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.12em] text-slate-950 transition-colors hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-100 disabled:cursor-not-allowed disabled:opacity-40">Lock team and scan Rifts</button>
      </div>
    </section>
  );
}
