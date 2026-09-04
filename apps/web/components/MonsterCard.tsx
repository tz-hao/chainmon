import type { Monster } from "@chainmon/shared";
import { RARITY_LABELS } from "@chainmon/shared";
import { PixelMonster } from "./PixelMonster";

interface MonsterCardProps {
  monster: Monster;
}

export function MonsterCard({ monster }: MonsterCardProps) {
  return (
    <article className="group relative flex h-full min-h-[202px] flex-col border border-slate-700 bg-[#0a1426] p-2 shadow-[3px_3px_0_rgba(2,6,23,0.9)] transition-[border-color,transform] hover:-translate-y-0.5 hover:border-amber-300/80">
      <div className="flex items-center justify-between font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
        <span>Dex {String(monster.speciesId).padStart(3, "0")}</span>
        <span className="border border-emerald-300/40 bg-emerald-300/10 px-1.5 py-0.5 text-emerald-200">
          Owned
        </span>
      </div>
      <div className="mt-2 grid h-32 place-items-center border border-slate-800 bg-[#050b17]">
        <PixelMonster
          speciesId={monster.speciesId}
          alt={monster.name}
          variant="battle-front"
          scale={2}
          priority={monster.speciesId <= 6}
          className="h-32 w-32"
        />
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <h3 className="truncate text-sm font-bold tracking-wide text-slate-100">{monster.name}</h3>
        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-amber-200">
          {RARITY_LABELS[monster.rarity]}
        </span>
      </div>
    </article>
  );
}
