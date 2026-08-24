"use client";

import { useState, useTransition } from "react";
import type { Monster } from "@chainmon/shared";
import { saveTeamAction } from "@/actions/battle";
import { ElementBadge } from "./ElementBadge";
import { RarityBadge } from "./RarityBadge";

interface TeamEditorProps {
  monsters: Monster[];
  initialTeam: (Monster | null)[];
  speciesImages: Record<number, string>;
}

export function TeamEditor({
  monsters,
  initialTeam,
  speciesImages,
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
    <div className="grid gap-8 lg:grid-cols-5">
      {/* Slots */}
      <section className="lg:col-span-2">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Battle Team
        </h2>
        <div className="space-y-3">
          {slots.map((monster, index) => (
            <div
              key={index}
              className={`flex items-center gap-3 rounded-xl border p-3 ${
                monster
                  ? "border-slate-700 bg-slate-800/60"
                  : "border-dashed border-slate-700 bg-slate-900/40"
              }`}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-800 text-sm font-bold text-slate-400">
                {index + 1}
              </span>
              {monster ? (
                <>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <img
                      src={
                        speciesImages[monster.speciesId] ??
                        "/monsters/placeholder.svg"
                      }
                      alt=""
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-lg bg-slate-950/40 object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-200">
                        {monster.name}
                        <span className="ml-1 text-xs font-normal text-amber-300">
                          Lv {monster.level}
                        </span>
                      </p>
                      <div className="mt-0.5 flex gap-1.5">
                        <ElementBadge element={monster.element} />
                        <RarityBadge rarity={monster.rarity} />
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSlot(index)}
                    className="shrink-0 rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-400 transition-colors hover:border-red-500/40 hover:text-red-300"
                  >
                    Remove
                  </button>
                </>
              ) : (
                <p className="text-sm text-slate-500">Empty slot — pick from below</p>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || slots.some((m) => m === null)}
          className="mt-4 w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Saving..." : "Save Team"}
        </button>
        {error ? (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        ) : null}
      </section>

      {/* Monster pool */}
      <section className="lg:col-span-3">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Your Monsters
        </h2>
        {monsters.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-12 text-center text-sm text-slate-400">
            No monsters yet — explore and capture some first!
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {monsters.map((monster) => {
              const selected = selectedIds.has(monster.id);
              return (
                <button
                  key={monster.id}
                  type="button"
                  onClick={() => addToSlot(monster)}
                  disabled={selected}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    selected
                      ? "cursor-not-allowed border-amber-500/30 bg-slate-900 opacity-50"
                      : "border-slate-800 bg-slate-900/60 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        speciesImages[monster.speciesId] ??
                        "/monsters/placeholder.svg"
                      }
                      alt=""
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-lg bg-slate-950/40 object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-200">
                        {monster.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        Lv {monster.level} · HP {monster.hp}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <ElementBadge element={monster.element} />
                    <RarityBadge rarity={monster.rarity} />
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
