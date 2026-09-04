"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { EvolutionEligibility } from "@chainmon/game-engine";
import { getSpeciesById, type MonsterSpeciesData } from "@chainmon/monster-data";
import type { Monster } from "@chainmon/shared";
import { evolveMonsterAction } from "@/actions/evolution";
import { ElementBadge } from "./ElementBadge";
import { getEvolutionVisualLine } from "@/lib/world/monster-visuals";
import { PixelMonster } from "./PixelMonster";
import { RarityBadge } from "./RarityBadge";

interface EvolutionPanelProps {
  monster: Monster;
  species: MonsterSpeciesData | undefined;
  target: MonsterSpeciesData | undefined;
  eligibility: EvolutionEligibility;
  inventory: { slug: string; name: string; quantity: number }[];
}

function EvolutionTrack({ speciesId }: { speciesId: number }) {
  const line = getEvolutionVisualLine(speciesId);
  const currentIndex = Math.max(
    0,
    line.findIndex((stage) => stage.speciesId === speciesId),
  );

  return (
    <div className="border border-slate-700 bg-[#080e18] p-2 sm:p-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
        <span>Evolution Line</span>
        <span className="text-amber-300">Stage {currentIndex + 1} online</span>
      </div>
      <ol className="mt-2 grid gap-2 sm:grid-cols-3 sm:gap-3">
        {line.map((stage, index) => {
          const isCurrent = index === currentIndex;
          const isFuture = index > currentIndex;
          const stageSpecies = getSpeciesById(stage.speciesId);
          const tone = isCurrent
            ? "border-amber-300 bg-[#292112] text-amber-100"
            : isFuture
              ? "border-slate-800 bg-[#0d1420] text-slate-600 opacity-55"
              : "border-emerald-800 bg-[#0c1b1b] text-emerald-300";

          return (
            <li
              key={stage.speciesId}
              className={`relative flex items-center gap-3 border p-2 sm:block sm:min-h-[13rem] sm:p-3 ${tone}`}
            >
              <span className="absolute left-2 top-2 border border-current px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]">
                Stage {index + 1}
              </span>
              <div className="mt-3 shrink-0 sm:mt-6 sm:flex sm:justify-center">
                <div className="sm:hidden">
                  <PixelMonster
                    speciesId={stage.speciesId}
                    variant="battle-front"
                    scale={1}
                    alt={stage.displayName}
                    priority
                  />
                </div>
                <div className="hidden sm:block">
                  <PixelMonster
                    speciesId={stage.speciesId}
                    variant="portrait"
                    scale={1}
                    alt={stage.displayName}
                    priority
                  />
                </div>
              </div>
              <div className="min-w-0 sm:mt-2 sm:text-center">
                <p className="truncate font-pixel text-xs uppercase tracking-[0.08em] text-slate-100 sm:text-sm">
                  {stageSpecies?.name ?? stage.displayName}
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
                  {isCurrent ? "Current form" : isFuture ? "Future form" : "Recorded form"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function RequirementRow({
  label,
  value,
  ready,
}: {
  label: string;
  value: string;
  ready: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-800 py-2 font-mono text-[11px] uppercase tracking-[0.08em]">
      <dt className="text-slate-500">{label}</dt>
      <dd className={ready ? "text-emerald-300" : "text-amber-300"}>{value}</dd>
    </div>
  );
}

export function EvolutionPanel({
  monster,
  species,
  target,
  eligibility,
  inventory,
}: EvolutionPanelProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{
    monster: Monster;
    oldHp: number;
    oldAttack: number;
    oldDefense: number;
    oldSpeed: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fireStone = inventory.find((item) => item.slug === "fire-stone")?.quantity ?? 0;
  const evolutionLevel = species?.evolution?.level ?? 1;
  const requiresItem = Boolean(species?.evolution?.item);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const actionResult = await evolveMonsterAction(formData);
      if (actionResult.ok && actionResult.monster) {
        setResult({
          monster: actionResult.monster,
          oldHp: monster.hp,
          oldAttack: monster.attack,
          oldDefense: monster.defense,
          oldSpeed: monster.speed,
        });
        router.refresh();
      } else if (actionResult.error) {
        setError(actionResult.error);
      }
    });
  }

  if (result) {
    const evolved = result.monster;
    return (
      <section className="border-2 border-emerald-500 bg-[#0b1a1b] p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3 border-b border-emerald-900 pb-2">
          <div>
            <p className="font-pixel text-sm uppercase tracking-[0.12em] text-emerald-300">Evolution complete</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">Identity and battle history retained</p>
          </div>
          <span className="border border-emerald-500 px-2 py-1 font-mono text-[10px] uppercase text-emerald-200">Synced</span>
        </div>
        <div className="mt-3">
          <EvolutionTrack speciesId={evolved.speciesId} />
        </div>
        <div className="mt-3 border border-emerald-900 bg-[#081314] p-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-slate-400">
            {species?.name} evolved into <span className="text-emerald-300">{evolved.name}</span>
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 sm:grid-cols-4">
            {[
              { label: "HP", before: result.oldHp, after: evolved.hp },
              { label: "ATK", before: result.oldAttack, after: evolved.attack },
              { label: "DEF", before: result.oldDefense, after: evolved.defense },
              { label: "SPD", before: result.oldSpeed, after: evolved.speed },
            ].map((row) => (
              <div key={row.label} className="border-t border-emerald-950 py-2 font-mono text-[10px] uppercase">
                <dt className="text-slate-500">{row.label}</dt>
                <dd className="mt-1 text-emerald-300">{row.before} → {row.after}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    );
  }

  if (!species?.evolution?.evolvesTo || !target) {
    return (
      <section className="border-2 border-slate-700 bg-[#0c1420] p-3 sm:p-4">
        <p className="font-pixel text-sm uppercase tracking-[0.12em] text-slate-300">Evolution</p>
        <p className="mt-2 font-mono text-xs text-slate-500">No further evolution route is recorded for this form.</p>
      </section>
    );
  }

  if (monster.mintStatus === "MINT_CONFIRMED") {
    return (
      <section className="border-2 border-slate-700 bg-[#0c1420] p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2">
          <div>
            <p className="font-pixel text-sm uppercase tracking-[0.12em] text-slate-200">Evolution protocol</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">On-chain asset detected</p>
          </div>
          <span className="border border-amber-500 px-2 py-1 font-mono text-[10px] uppercase text-amber-300">Chain first</span>
        </div>
        <div className="mt-3"><EvolutionTrack speciesId={monster.speciesId} /></div>
        <p className="mt-3 font-mono text-xs leading-5 text-slate-400">
          Use <span className="text-amber-300">On-chain Evolution</span> in the asset panel. The server validates level, item and route before game state syncs.
        </p>
      </section>
    );
  }

  return (
    <section className="border-2 border-slate-700 bg-[#0c1420] p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-2">
        <div>
          <p className="font-pixel text-sm uppercase tracking-[0.12em] text-slate-200">Evolution protocol</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">Advance {species.name} to {target.name}</p>
        </div>
        <span className="border border-slate-600 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-slate-400">
          Route verified
        </span>
      </div>

      <div className="mt-3"><EvolutionTrack speciesId={monster.speciesId} /></div>

      <dl className="mt-3 border border-slate-800 bg-[#080e18] px-3">
        <RequirementRow
          label="Required level"
          ready={monster.level >= evolutionLevel}
          value={monster.level >= evolutionLevel ? `${evolutionLevel} ready` : `${evolutionLevel} / current ${monster.level}`}
        />
        <RequirementRow
          label={requiresItem ? `${species.evolution.item} x1` : "Evolution item"}
          ready={!requiresItem || fireStone > 0}
          value={requiresItem ? (fireStone > 0 ? `Bag ${fireStone}` : "Not in bag") : "Not required"}
        />
      </dl>

      {confirming ? (
        <form onSubmit={handleSubmit} className="mt-3 border border-amber-500 bg-[#211b11] p-3">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-amber-100">
            Confirm evolution: {species.name} → {target.name}
          </p>
          {requiresItem ? (
            <p className="mt-1 font-mono text-[10px] uppercase text-amber-300/80">Consumes {species.evolution.item} x1</p>
          ) : null}
          <input type="hidden" name="monsterId" value={monster.id} />
          <div className="mt-3 grid gap-2 sm:flex">
            <button type="submit" disabled={pending} className="rift-button-primary disabled:cursor-not-allowed disabled:opacity-50">
              {pending ? "Evolving..." : "Confirm evolution"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={pending} className="rift-button-secondary disabled:cursor-not-allowed disabled:opacity-50">
              Cancel
            </button>
          </div>
          {error ? <p className="mt-3 border border-red-500 bg-red-950/40 px-3 py-2 font-mono text-xs text-red-200">{error}</p> : null}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={!eligibility.eligible}
          className="rift-button-primary mt-3 w-full disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
        >
          {eligibility.eligible
            ? `Evolve to ${target.name}`
            : eligibility.missingLevel
              ? `Requires level ${eligibility.missingLevel}`
              : `Requires ${species.evolution.item ?? ""} x1`}
        </button>
      )}
    </section>
  );
}
