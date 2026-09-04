import Link from "next/link";
import { MonsterGrid } from "@/components/MonsterGrid";
import { WEB3_CONCEPTS, unlockedConcepts } from "@/components/world/KnowledgeCard";
import { requirePageTrainer } from "@/lib/auth/current-trainer";

export const dynamic = "force-dynamic";

export default async function MonstersPage() {
  const { repository, trainer } = await requirePageTrainer();
  const monsters = await repository.listMonsters(trainer.id);
  // Knowledge Dex: concepts unlocked by capturing Web3 monsters.
  const ownedSpecies = new Set(monsters.map((m) => m.speciesId));
  const unlocked = unlockedConcepts(
    [...ownedSpecies],
    monsters.flatMap((m) => m.skills.map((s) => ({ id: s.id, name: s.name }))),
  );

  return (
    <div className="animate-fade-in-up">
      <header className="mb-5 border-b-2 border-amber-300/70 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200">Field Guide // 028 Species</p>
            <h1 className="mt-1 text-2xl font-black uppercase tracking-[0.06em] text-slate-100 sm:text-3xl">Collection</h1>
            <p className="mt-1 text-xs text-slate-400">{trainer.nickname}&apos;s registered creatures. Select an owned entry for its full record.</p>
          </div>
          <div className="border border-emerald-300/40 bg-emerald-300/10 px-3 py-2 text-right font-mono">
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-200">Captured</p>
            <p className="mt-0.5 text-sm font-black text-slate-100">{monsters.length} / 28</p>
          </div>
        </div>
      </header>

      {monsters.length === 0 ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border border-amber-300/40 bg-amber-300/10 px-4 py-3">
          <p className="text-sm text-amber-100">No creature registered. Browse the 28-species field guide, then select your starter.</p>
          <Link href="/login" className="border border-amber-200 bg-amber-300 px-3 py-2 font-mono text-xs font-black uppercase tracking-[0.08em] text-slate-950 transition-colors hover:bg-amber-200">Choose starter</Link>
        </div>
      ) : null}

      <MonsterGrid monsters={monsters} />

      {/* Knowledge Dex */}
      <section className="mt-7 border border-slate-800 bg-[#081222] p-4 sm:p-5">
        <h2 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-violet-200">
          Web3 Knowledge
        </h2>
        <p className="mb-3 text-xs text-slate-400">
          Capture Web3 creatures to unlock their concepts.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {WEB3_CONCEPTS.map((concept) => {
            const isUnlocked = unlocked.has(concept.id);
            return (
              <div
                key={concept.id}
                className={`border p-3 ${
                  isUnlocked
                    ? "border-violet-300/45 bg-violet-300/10"
                    : "border-slate-800 bg-[#060d1a] opacity-60"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-slate-100">
                    {concept.title}
                  </span>
                  <span className={`border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] ${isUnlocked ? "border-emerald-400/30 text-emerald-200" : "border-slate-700 text-slate-500"}`}>
                    {isUnlocked ? "Unlocked" : "Locked"}
                  </span>
                </div>
                {isUnlocked ? (
                  <p className="mt-1 text-xs text-slate-300">{concept.summary}</p>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">
                    Capture {concept.monster} to unlock
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
