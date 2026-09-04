"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { MonsterSpeciesData } from "@chainmon/monster-data";
import { createTrainerAction } from "@/actions/trainer";
import { ElementBadge } from "./ElementBadge";
import { PixelMonster } from "./PixelMonster";

interface OnboardingFlowProps {
  starters: readonly MonsterSpeciesData[];
}

export function OnboardingFlow({ starters }: OnboardingFlowProps) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSlug) {
      setError("Choose a starter monster first.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    formData.set("starter", selectedSlug);
    setError(null);
    startTransition(async () => {
      const result = await createTrainerAction(formData);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      {/* Starter selection */}
      <div className="lg:col-span-3">
        <h2 className="mb-1 text-lg font-semibold text-slate-100">
          Choose your starter monster
        </h2>
        <p className="mb-4 text-sm text-slate-400">
          Every trainer begins with one faithful partner. Pick wisely — it will
          grow with you.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {starters.map((starter) => {
            const selected = selectedSlug === starter.slug;
            return (
              <button
                key={starter.slug}
                type="button"
                onClick={() => setSelectedSlug(starter.slug)}
                className={`rounded-2xl border bg-slate-950/70 p-4 text-left transition-all ${
                  selected
                    ? "border-amber-400 ring-2 ring-amber-400/40"
                    : "border-slate-800 hover:border-slate-600"
                }`}
              >
                <PixelMonster
                  speciesId={starter.id}
                  variant="portrait"
                  alt={starter.name}
                  className="mx-auto h-32 w-32 bg-slate-950/80 p-2"
                />
                <h3 className="mt-3 text-center font-bold text-slate-100">
                  {starter.name}
                </h3>
                <div className="mt-2 flex justify-center">
                  <ElementBadge element={starter.element} />
                </div>
                <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
                  HP {starter.baseHp} · ATK {starter.baseAttack} · DEF{" "}
                  {starter.baseDefense} · SPD {starter.baseSpeed}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Nickname form */}
      <form
        onSubmit={handleSubmit}
        className="h-fit rounded-2xl border border-slate-800 bg-slate-900/60 p-6 lg:col-span-2"
      >
        <h2 className="text-lg font-semibold text-slate-100">
          Create your trainer
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Choose a nickname for your trainer profile.
        </p>
        <label
          htmlFor="nickname"
          className="mt-5 block text-xs font-semibold uppercase tracking-wider text-slate-500"
        >
          Nickname
        </label>
        <input
          id="nickname"
          name="nickname"
          type="text"
          maxLength={20}
          placeholder="e.g. Ash"
          disabled={pending}
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="mt-4 w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Creating trainer..." : "Create Trainer & Start"}
        </button>
        {error ? (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        ) : null}
        <p className="mt-4 text-xs text-slate-500">
          Demo account: <code className="text-slate-400">demo@chainmon.local</code>
          . Real authentication (email / wallet) arrives in Phase 7.
        </p>
      </form>
    </div>
  );
}
