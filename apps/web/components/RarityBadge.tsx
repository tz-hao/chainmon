import { RARITY_LABELS, type Rarity } from "@chainmon/shared";

const RARITY_STYLES: Record<Rarity, string> = {
  common: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
  rare: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  epic: "bg-purple-500/15 text-purple-300 ring-purple-500/30",
  legendary: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
};

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${RARITY_STYLES[rarity]}`}
    >
      {RARITY_LABELS[rarity]}
    </span>
  );
}
