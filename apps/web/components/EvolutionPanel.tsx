"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { EvolutionEligibility } from "@chainmon/game-engine";
import type { MonsterSpeciesData } from "@chainmon/monster-data";
import type { Monster } from "@chainmon/shared";
import { evolveMonsterAction } from "@/actions/evolution";
import { ElementBadge } from "./ElementBadge";
import { RarityBadge } from "./RarityBadge";
import { getMonsterVisualPath } from "@/lib/world/monster-visuals";

interface EvolutionPanelProps {
  monster: Monster;
  species: MonsterSpeciesData | undefined;
  target: MonsterSpeciesData | undefined;
  eligibility: EvolutionEligibility;
  inventory: { slug: string; name: string; quantity: number }[];
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

  const fireStone = inventory.find((i) => i.slug === "fire-stone")?.quantity ?? 0;

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

  // ---- Success state ----
  if (result) {
    const evolved = result.monster;
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-300">
          Evolution Complete!
        </p>
        <div className="mt-4 flex items-center gap-4">
          <img
            src={species ? getMonsterVisualPath(species.id, "portrait") : "/monsters/placeholder.svg"}
            alt=""
            width={72}
            height={72}
            className="h-20 w-20 rounded-xl bg-slate-950/40 object-cover"
          />
          <span className="text-2xl text-slate-500">↓</span>
          <img
            src={target ? getMonsterVisualPath(target.id, "portrait") : "/monsters/placeholder.svg"}
            alt=""
            width={72}
            height={72}
            className="h-20 w-20 rounded-xl bg-slate-950/40 object-cover"
          />
        </div>
        <p className="mt-3 text-lg font-bold text-slate-100">
          {species?.name} → {evolved.name}
        </p>
        <div className="mt-1 flex gap-1.5">
          <ElementBadge element={evolved.element} />
          <RarityBadge rarity={evolved.rarity} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {[
            { label: "HP", before: result.oldHp, after: evolved.hp },
            { label: "Attack", before: result.oldAttack, after: evolved.attack },
            { label: "Defense", before: result.oldDefense, after: evolved.defense },
            { label: "Speed", before: result.oldSpeed, after: evolved.speed },
          ].map((row) => (
            <div key={row.label} className="rounded-xl bg-slate-800/60 p-3 text-center">
              <p className="text-xs text-slate-500">{row.label}</p>
              <p className="mt-1 font-bold text-emerald-300">
                {row.before} → {row.after}
              </p>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          DNA, level and battle history are preserved.
        </p>
      </div>
    );
  }

  if (!species?.evolution?.evolvesTo || !target) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Evolution
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          This monster has no evolution route.
        </p>
      </div>
    );
  }

  // Minted monsters evolve on-chain first (see Web3Panel — On-chain Evolution).
  if (monster.mintStatus === "MINT_CONFIRMED") {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Evolution
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          This monster is minted as an NFT — evolution runs on-chain first
          (level / item / route validated by the server), then the game state
          is synced. Use{" "}
          <span className="font-semibold text-amber-300">On-chain Evolution</span>{" "}
          in the On-chain Asset panel.
        </p>
      </div>
    );
  }

  const requiresItem = Boolean(species.evolution.item);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
        Evolution
      </h2>

      <div className="mt-4 flex items-center gap-4">
        <img
          src={getMonsterVisualPath(species.id, "portrait")}
          alt=""
          width={64}
          height={64}
          className="h-16 w-16 rounded-xl bg-slate-950/40 object-cover"
        />
        <span className="text-xl text-slate-500">↓</span>
        <img
          src={getMonsterVisualPath(target.id, "portrait")}
          alt=""
          width={64}
          height={64}
          className="h-16 w-16 rounded-xl bg-slate-950/40 object-cover"
        />
        <p className="font-bold text-slate-100">{target.name}</p>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-slate-500">Required Level</dt>
          <dd className={eligibility.eligible ? "text-emerald-300" : "text-slate-300"}>
            {species.evolution.level ?? 1}{" "}
            {monster.level >= (species.evolution.level ?? 1) ? "✅" : `(current ${monster.level})`}
          </dd>
        </div>
        {requiresItem ? (
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">
              {species.evolution.item} ×1
            </dt>
            <dd className={fireStone > 0 ? "text-emerald-300" : "text-red-300"}>
              {fireStone > 0 ? `✅ (you have ${fireStone})` : "❌ not in your bag"}
            </dd>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Evolution Item</dt>
            <dd className="text-emerald-300">Not required</dd>
          </div>
        )}
      </dl>

      {confirming ? (
        <form onSubmit={handleSubmit} className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm text-amber-200">
            Evolve {species.name} into {target.name}?
            {requiresItem ? (
              <span className="block text-xs text-amber-300/80">
                This will consume {species.evolution.item} ×1.
              </span>
            ) : null}
          </p>
          <input type="hidden" name="monsterId" value={monster.id} />
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
            >
              {pending ? "Evolving..." : "Confirm Evolution"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 transition-colors hover:text-slate-200"
            >
              Cancel
            </button>
          </div>
          {error ? (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          ) : null}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={!eligibility.eligible}
          className={`mt-5 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
            eligibility.eligible
              ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
              : "cursor-not-allowed bg-slate-800 text-slate-500"
          }`}
        >
          {eligibility.eligible
            ? `Evolve to ${target.name}`
            : eligibility.missingLevel
              ? `Requires Level ${eligibility.missingLevel}`
              : `Requires ${species.evolution.item ?? ""} ×1`}
        </button>
      )}
    </div>
  );
}
