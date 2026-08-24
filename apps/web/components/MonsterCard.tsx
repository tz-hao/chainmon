"use client";

import { useState } from "react";
import { getRequiredExp } from "@chainmon/game-engine";
import type { Element, Monster } from "@chainmon/shared";
import type { MonsterSpeciesData } from "@chainmon/monster-data";
import { getMonsterVisualPath } from "@/lib/world/monster-visuals";
import { ElementBadge } from "./ElementBadge";
import { RarityBadge } from "./RarityBadge";

const ELEMENT_CARD_STYLES: Record<Element, string> = {
  fire: "from-red-950/70 to-orange-900/30 ring-red-500/25",
  water: "from-sky-950/70 to-blue-900/30 ring-sky-500/25",
  nature: "from-emerald-950/70 to-green-900/30 ring-emerald-500/25",
  electric: "from-yellow-950/70 to-amber-900/30 ring-yellow-500/25",
};

interface MonsterCardProps {
  monster: Monster;
  species: MonsterSpeciesData | undefined;
}

/**
 * Collection card — sprite ≥96×96 (Pixel World visual upgrade), resolved
 * through the central monster-visuals manifest. Falls back to the species
 * SVG only when no pixel portrait exists.
 */
export function MonsterCard({ monster, species }: MonsterCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const portrait = getMonsterVisualPath(monster.speciesId, "portrait");
  const fallback = species?.image ?? "/monsters/placeholder.svg";
  const src = imageFailed ? fallback : portrait;

  const mintStatus = monster.mintStatus ?? "OFFCHAIN";
  const nftBadge =
    mintStatus === "MINT_CONFIRMED"
      ? { text: `NFT #${monster.tokenId ?? "?"}`, cls: "bg-amber-500/15 text-amber-300 ring-amber-500/30" }
      : mintStatus === "MINT_SUBMITTED"
        ? { text: "Submitted", cls: "bg-sky-500/15 text-sky-300 ring-sky-500/30" }
        : mintStatus === "MINT_PENDING"
          ? { text: "Claiming", cls: "bg-yellow-500/15 text-yellow-300 ring-yellow-500/30" }
          : mintStatus === "MINT_FAILED"
            ? { text: "Failed", cls: "bg-red-500/15 text-red-300 ring-red-500/30" }
            : { text: "Off-chain", cls: "bg-slate-500/15 text-slate-400 ring-slate-500/30" };

  return (
    <div
      className={`rounded-2xl border border-slate-800 bg-gradient-to-br p-4 ring-1 transition-colors hover:border-slate-600 ${ELEMENT_CARD_STYLES[monster.element]}`}
    >
      <div className="flex items-start justify-between">
        <img
          src={src}
          alt={monster.name}
          width={96}
          height={96}
          onError={() => setImageFailed(true)}
          className="h-24 w-24 rounded-xl bg-slate-950/40 object-contain p-1"
          style={{ imageRendering: "pixelated" }}
        />
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full bg-slate-950/60 px-2 py-0.5 text-xs font-bold text-amber-300">
            Lv {monster.level}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${nftBadge.cls}`}
          >
            {nftBadge.text}
          </span>
        </div>
      </div>

      <h3 className="mt-3 font-bold text-slate-100">{monster.name}</h3>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <ElementBadge element={monster.element} />
        <RarityBadge rarity={monster.rarity} />
        {monster.speciesId >= 21 ? (
          <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-300 ring-1 ring-purple-500/30">
            WEB3
          </span>
        ) : null}
      </div>

      <dl className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-950/40 p-2 text-center">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">HP</dt>
          <dd className="text-sm font-semibold text-emerald-300">{monster.hp}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">ATK</dt>
          <dd className="text-sm font-semibold text-red-300">{monster.attack}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">DEF</dt>
          <dd className="text-sm font-semibold text-sky-300">{monster.defense}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">SPD</dt>
          <dd className="text-sm font-semibold text-yellow-300">{monster.speed}</dd>
        </div>
      </dl>

      {/* EXP progress (Phase 5) */}
      <div className="mt-2 rounded-xl bg-slate-950/40 p-2">
        <div className="mb-1 flex justify-between text-[10px] text-slate-500">
          <span>EXP</span>
          <span className="tabular-nums">
            {monster.exp} / {getRequiredExp(monster.level)}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-500"
            style={{
              width: `${Math.min(
                100,
                Math.round(
                  (monster.exp / Math.max(getRequiredExp(monster.level), 1)) *
                    100,
                ),
              )}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
