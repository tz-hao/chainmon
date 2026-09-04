"use client";

import Link from "next/link";
import { useState } from "react";
import { RARITY_LABELS, type Element, type Monster, type Rarity } from "@chainmon/shared";
import { MONSTER_SPECIES } from "@chainmon/monster-data";
import { MonsterCard } from "./MonsterCard";
import { PixelMonster } from "./PixelMonster";

type ElementFilter = "all" | Element;
type RarityFilter = "all" | Rarity;
type OwnershipFilter = "all" | "owned" | "unowned";

const ELEMENT_FILTERS: readonly ElementFilter[] = [
  "all",
  "fire",
  "water",
  "nature",
  "electric",
];

const RARITY_FILTERS: readonly RarityFilter[] = [
  "all",
  "common",
  "rare",
  "epic",
  "legendary",
];

const FILTER_LABELS: Record<string, string> = {
  all: "All",
  fire: "Fire",
  water: "Water",
  nature: "Nature",
  electric: "Electric",
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  owned: "Owned",
  unowned: "Missing",
};

interface MonsterGridProps {
  monsters: Monster[];
}

function UnownedSpeciesCard({ species }: { species: (typeof MONSTER_SPECIES)[number] }) {
  return (
    <article className="relative flex h-full min-h-[202px] flex-col border border-slate-800 bg-[#070f1e] p-2 shadow-[3px_3px_0_rgba(2,6,23,0.9)]">
      <div className="flex items-center justify-between font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">
        <span>Dex {String(species.id).padStart(3, "0")}</span>
        <span className="border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-slate-500">
          Locked
        </span>
      </div>
      <div className="mt-2 grid h-32 place-items-center border border-slate-800 bg-[#050b17]">
        <PixelMonster
          speciesId={species.id}
          variant="battle-front"
          alt={species.name}
          scale={2}
          priority={species.id <= 6}
          className="h-32 w-32 opacity-35 grayscale"
        />
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <h3 className="truncate text-sm font-bold tracking-wide text-slate-500">{species.name}</h3>
        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-600">
          {RARITY_LABELS[species.rarity]}
        </span>
      </div>
    </article>
  );
}

export function MonsterGrid({ monsters }: MonsterGridProps) {
  const [element, setElement] = useState<ElementFilter>("all");
  const [rarity, setRarity] = useState<RarityFilter>("all");
  const [ownership, setOwnership] = useState<OwnershipFilter>("all");

  const ownedBySpecies = new Map<number, Monster[]>();
  for (const monster of monsters) {
    const current = ownedBySpecies.get(monster.speciesId) ?? [];
    current.push(monster);
    ownedBySpecies.set(monster.speciesId, current);
  }

  const filtered = MONSTER_SPECIES.filter(
    (species) =>
      (element === "all" || species.element === element) &&
      (rarity === "all" || species.rarity === rarity) &&
      (ownership === "all" || (ownership === "owned") === ownedBySpecies.has(species.id)),
  );

  return (
    <div>
      <div className="mb-5 border-y border-slate-800 bg-[#081222] px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="w-14 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Element
          </span>
          {ELEMENT_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={element === value}
              onClick={() => setElement(value)}
              className={`border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] transition-colors ${
                element === value
                  ? "border-amber-300/80 bg-amber-300/10 text-amber-100"
                  : "border-slate-800 bg-[#060d1a] text-slate-500 hover:border-slate-600 hover:text-slate-200"
              }`}
            >
              {FILTER_LABELS[value]}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="w-14 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Rarity
          </span>
          {RARITY_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={rarity === value}
              onClick={() => setRarity(value)}
              className={`border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] transition-colors ${
                rarity === value
                  ? "border-amber-300/80 bg-amber-300/10 text-amber-100"
                  : "border-slate-800 bg-[#060d1a] text-slate-500 hover:border-slate-600 hover:text-slate-200"
              }`}
            >
              {FILTER_LABELS[value]}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="w-14 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Status
          </span>
          {(["all", "owned", "unowned"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={ownership === value}
              onClick={() => setOwnership(value)}
              className={`border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] transition-colors ${
                ownership === value
                  ? "border-amber-300/80 bg-amber-300/10 text-amber-100"
                  : "border-slate-800 bg-[#060d1a] text-slate-500 hover:border-slate-600 hover:text-slate-200"
              }`}
            >
              {FILTER_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="border border-dashed border-slate-700 bg-[#081222] px-6 py-12 text-center text-sm text-slate-400">
          No monsters match the current filters.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 xl:grid-cols-6">
          {filtered.map((species) => {
            const owned = ownedBySpecies.get(species.id) ?? [];
            const primary = [...owned].sort((a, b) => b.level - a.level)[0];
            return primary ? (
              <Link
                key={species.id}
                href={`/monsters/${primary.id}`}
                className="group h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
              >
                <MonsterCard monster={primary} />
                {owned.length > 1 ? (
                  <span className="-mt-6 mr-2 block text-right font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-amber-200">
                    ×{owned.length} owned
                  </span>
                ) : null}
              </Link>
            ) : (
              <UnownedSpeciesCard key={species.id} species={species} />
            );
          })}
        </div>
      )}
    </div>
  );
}
