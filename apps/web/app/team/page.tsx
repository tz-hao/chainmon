import Link from "next/link";
import { MONSTER_SPECIES } from "@chainmon/monster-data";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { TeamEditor } from "@/components/TeamEditor";
import { requirePageTrainer } from "@/lib/auth/current-trainer";
import { getMonsterVisualPath } from "@/lib/world/monster-visuals";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { repository, trainer } = await requirePageTrainer();
  const monsters = await repository.listMonsters(trainer.id);
  const team = await repository.getTeam(trainer.id);

  type TeamMonster = (typeof monsters)[number];
  const initialTeam: (TeamMonster | null)[] = team
    ? [...team, null, null, null].slice(0, 3)
    : [null, null, null];

  const speciesImages = Object.fromEntries(
    MONSTER_SPECIES.map((species) => [species.id, getMonsterVisualPath(species.id, "portrait")]),
  ) as Record<number, string>;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Team"
        subtitle="Choose exactly 3 monsters for your battle team."
        badge="Phase 4"
      />
      {monsters.length < 3 ? (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
          <p className="text-sm text-amber-200">
            You need at least 3 monsters to battle. You currently own{" "}
            {monsters.length}.
          </p>
          <Link
            href="/world/select"
            className="mt-2 inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
          >
            Explore & Capture
          </Link>
        </div>
      ) : null}
      <TeamEditor
        monsters={monsters}
        initialTeam={initialTeam}
        speciesImages={speciesImages}
      />
    </div>
  );
}
