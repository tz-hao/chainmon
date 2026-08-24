"use client";

import Link from "next/link";
import { useState } from "react";
import type { Element, Monster, Rarity } from "@chainmon/shared";
import type { MonsterSpeciesData } from "@chainmon/monster-data";
import { MonsterCard } from "./MonsterCard";

type ElementFilter = "all" | Element;
type RarityFilter = "all" | Rarity;

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
};

interface MonsterGridProps {
  monsters: Monster[];
  speciesById: Record<number, MonsterSpeciesData>;
}

export function MonsterGrid({ monsters, speciesById }: MonsterGridProps) {
  const [element, setElement] = useState<ElementFilter>("all");
  const [rarity, setRarity] = useState<RarityFilter>("all");

  const filtered = monsters.filter(
    (monster) =>
      (element === "all" || monster.element === element) &&
      (rarity === "all" || monster.rarity === rarity),
  );

  return (
    <div>
      <div className="mb-6 space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Element
          </span>
          {ELEMENT_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setElement(value)}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${
                element === value
                  ? "bg-amber-500/20 text-amber-300 ring-amber-500/40"
                  : "bg-slate-900 text-slate-400 ring-slate-800 hover:text-slate-200"
              }`}
            >
              {FILTER_LABELS[value]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Rarity
          </span>
          {RARITY_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRarity(value)}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${
                rarity === value
                  ? "bg-amber-500/20 text-amber-300 ring-amber-500/40"
                  : "bg-slate-900 text-slate-400 ring-slate-800 hover:text-slate-200"
              }`}
            >
              {FILTER_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-12 text-center text-sm text-slate-400">
          No monsters match the current filters.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((monster) => (
            <Link
              key={monster.id}
              href={`/monsters/${monster.id}`}
              className="transition-transform hover:-translate-y-0.5"
            >
              <MonsterCard
                monster={monster}
                species={speciesById[monster.speciesId]}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
