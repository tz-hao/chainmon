import Link from "next/link";
import { MONSTER_SPECIES } from "@chainmon/monster-data";
import { EmptyState } from "@/components/EmptyState";
import { MonsterGrid } from "@/components/MonsterGrid";
import { PageHeader } from "@/components/PageHeader";
import { WEB3_CONCEPTS, unlockedConcepts } from "@/components/world/KnowledgeCard";
import { requirePageTrainer } from "@/lib/auth/current-trainer";

export const dynamic = "force-dynamic";

export default async function MonstersPage() {
  const { repository, trainer } = await requirePageTrainer();
  const monsters = await repository.listMonsters(trainer.id);
  const speciesById = Object.fromEntries(
    MONSTER_SPECIES.map((species) => [species.id, species]),
  ) as Record<number, (typeof MONSTER_SPECIES)[number]>;

  // Knowledge Dex: concepts unlocked by capturing Web3 monsters.
  const ownedSpecies = new Set(monsters.map((m) => m.speciesId));
  const unlocked = unlockedConcepts(
    [...ownedSpecies],
    monsters.flatMap((m) => m.skills.map((s) => ({ id: s.id, name: s.name }))),
  );

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Monster Collection"
        subtitle={
          `${trainer.nickname}'s monsters — click a monster for its full profile.`
        }
        badge={`${monsters.length} owned`}
      />

      {monsters.length === 0 ? (
        <>
          <EmptyState
            icon="🥚"
            title="Your collection is empty"
            description="Choose your starter monster to hatch your very first partner."
            action={
              <Link
                href="/login"
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
              >
                Choose Starter
              </Link>
            }
          />
        </>
      ) : (
        <>
          <MonsterGrid monsters={monsters} speciesById={speciesById} />

          {/* Knowledge Dex */}
          <div className="mt-8 rounded-2xl border border-purple-500/30 bg-slate-900/60 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-purple-300">
              📚 Web3 Knowledge
            </h2>
            <p className="mb-4 text-xs text-slate-400">
              Capture Web3 creatures to unlock their concepts.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {WEB3_CONCEPTS.map((concept) => {
                const isUnlocked = unlocked.has(concept.id);
                return (
                  <div
                    key={concept.id}
                    className={`rounded-xl border p-3 ${
                      isUnlocked
                        ? "border-purple-500/40 bg-purple-500/10"
                        : "border-slate-800 bg-slate-800/40 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-100">
                        {concept.title}
                      </span>
                      <span className="text-xs">
                        {isUnlocked ? "✅" : "🔒"}
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
          </div>

        </>
      )}
    </div>
  );
}
