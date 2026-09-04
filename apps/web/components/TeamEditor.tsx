"use client";

import { useState, useTransition } from "react";
import { ELEMENT_LABELS, RARITY_LABELS, type Monster } from "@chainmon/shared";
import { saveTeamAction } from "@/actions/battle";
import { PixelMonster } from "./PixelMonster";

interface TeamEditorProps {
  monsters: Monster[];
  initialTeam: (Monster | null)[];
}

const SLOT_NAMES = ["Lead", "Wing", "Anchor"] as const;

const ELEMENT_COLORS = {
  fire: "text-orange-200 border-orange-300/35 bg-orange-300/10",
  water: "text-cyan-200 border-cyan-300/35 bg-cyan-300/10",
  nature: "text-emerald-200 border-emerald-300/35 bg-emerald-300/10",
  electric: "text-yellow-200 border-yellow-300/35 bg-yellow-300/10",
} as const;

function VitalityBar({ hp }: { hp: number }) {
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
        <span>Vitality</span>
        <span className="text-emerald-200">HP {hp}</span>
      </div>
      <div className="h-2 border border-slate-700 bg-[#050b17] p-[2px]">
        <span className="block h-full bg-emerald-300" style={{ width: `${Math.min(100, Math.max(18, hp / 1.2))}%` }} />
      </div>
    </div>
  );
}

export function TeamEditor({
  monsters,
  initialTeam,
}: TeamEditorProps) {
  const [slots, setSlots] = useState<(Monster | null)[]>([...initialTeam]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedIds = new Set(
    slots.filter((m): m is Monster => m !== null).map((m) => m.id),
  );

  function addToSlot(monster: Monster) {
    setError(null);
    if (selectedIds.has(monster.id)) return;
    const next = [...slots];
    const emptyIndex = next.findIndex((m) => m === null);
    if (emptyIndex >= 0) {
      next[emptyIndex] = monster;
    } else {
      setError("Your team is full — remove a monster first.");
      return;
    }
    setSlots(next);
  }

  function removeSlot(index: number) {
    setError(null);
    const next = [...slots];
    next[index] = null;
    setSlots(next);
  }

  function handleSave() {
    if (slots.some((m) => m === null)) {
      setError("Select 3 monsters first.");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("slot1", slots[0]!.id);
    formData.set("slot2", slots[1]!.id);
    formData.set("slot3", slots[2]!.id);
    startTransition(async () => {
      const result = await saveTeamAction(formData);
      if (!result.ok && result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <section aria-labelledby="squad-lineup-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200">Squad lineup</p>
            <h2 id="squad-lineup-title" className="mt-1 text-lg font-black uppercase tracking-[0.04em] text-slate-100">Battle formation</h2>
          </div>
          <span className="border border-slate-700 bg-[#081222] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
            {selectedIds.size} / 3 deployed
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {slots.map((monster, index) => (
            <div
              key={index}
              className={`relative min-h-[244px] border p-4 shadow-[3px_3px_0_rgba(2,6,23,0.9)] ${
                monster
                  ? "border-slate-700 bg-[#0a1426]"
                  : "border-dashed border-slate-700 bg-[#07101f]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">Slot {String(index + 1).padStart(2, "0")}</p>
                  <p className="mt-1 font-mono text-xs font-black uppercase tracking-[0.08em] text-amber-100">{SLOT_NAMES[index]}</p>
                </div>
                {monster ? (
                  <button
                    type="button"
                    onClick={() => removeSlot(index)}
                    className="border border-slate-700 bg-[#050b17] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400 transition-colors hover:border-red-300/60 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              {monster ? (
                <div className="mt-3">
                  <div className="grid h-28 place-items-center border border-slate-800 bg-[#050b17]">
                    <PixelMonster
                      speciesId={monster.speciesId}
                      alt=""
                      decorative
                      variant="battle-front"
                      scale={2}
                      className="h-28 w-28"
                    />
                  </div>
                  <div className="mt-3 flex items-baseline justify-between gap-2">
                    <h3 className="truncate font-bold text-slate-100">{monster.name}</h3>
                    <span className="shrink-0 font-mono text-[10px] font-black text-amber-200">LV {monster.level}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className={`border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] ${ELEMENT_COLORS[monster.element]}`}>{ELEMENT_LABELS[monster.element]}</span>
                    <span className="border border-slate-700 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{RARITY_LABELS[monster.rarity]}</span>
                  </div>
                  <VitalityBar hp={monster.hp} />
                </div>
              ) : (
                <div className="grid h-40 place-items-center border border-dashed border-slate-700 bg-[#050b17] px-5 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">Empty slot<br />Choose a reserve unit below</p>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={pending || slots.some((m) => m === null)}
            className="border border-amber-200 bg-amber-300 px-4 py-2.5 font-mono text-[11px] font-black uppercase tracking-[0.1em] text-slate-950 transition-colors hover:bg-amber-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
          >
            {pending ? "Syncing squad..." : "Confirm squad"}
          </button>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">Three active units required for battle</p>
        </div>
        {error ? (
          <p className="mt-3 border border-red-300/35 bg-red-300/10 px-3 py-2 font-mono text-xs text-red-200">
            {error}
          </p>
        ) : null}
      </section>

      <section className="mt-7 border-t border-slate-800 pt-5" aria-labelledby="reserve-title">
        <div className="mb-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200">Reserve roster</p>
          <h2 id="reserve-title" className="mt-1 text-lg font-black uppercase tracking-[0.04em] text-slate-100">Choose deployment</h2>
        </div>
        {monsters.length === 0 ? (
          <p className="border border-dashed border-slate-700 bg-[#081222] px-6 py-12 text-center text-sm text-slate-400">
            No monsters yet — explore and capture some first!
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            {monsters.map((monster) => {
              const selected = selectedIds.has(monster.id);
              return (
                <button
                  key={monster.id}
                  type="button"
                  onClick={() => addToSlot(monster)}
                  disabled={selected}
                  className={`border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 ${
                    selected
                      ? "cursor-not-allowed border-amber-300/30 bg-[#081222] opacity-55"
                      : "border-slate-800 bg-[#07101f] hover:border-amber-300/60 hover:bg-[#0a1426]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <PixelMonster
                      speciesId={monster.speciesId}
                      alt=""
                      decorative
                      variant="battle-front"
                      scale={1}
                      className="h-16 w-16 border border-slate-800 bg-[#050b17]"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-200">{monster.name}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">
                        Lv {monster.level} · HP {monster.hp}
                      </p>
                      <span className="mt-2 inline-block border border-slate-700 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{selected ? "Deployed" : "Select"}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
