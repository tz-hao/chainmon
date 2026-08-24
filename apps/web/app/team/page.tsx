import Link from "next/link";
import { MONSTER_SPECIES } from "@chainmon/monster-data";
import { DemoModeNote } from "@/components/DemoModeNote";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { TeamEditor } from "@/components/TeamEditor";
import { getRepository } from "@/lib/data";
import { getMonsterVisualPath } from "@/lib/world/monster-visuals";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const repository = await getRepository();
  const trainer = await repository.getDemoTrainer();
  const monsters = trainer ? await repository.listMonsters() : [];
  const team = trainer ? await repository.getTeam(trainer.id) : null;

  if (!trainer) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader
          title="Team"
          subtitle="Assemble up to three monsters for 3v3 battles."
          badge="Phase 4"
        />
        <EmptyState
          icon="🎒"
          title="No trainer yet"
          description="Create your trainer first, then build your battle team."
          action={
            <Link
              href="/login"
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
            >
              Create Trainer
            </Link>
          }
        />
        {repository.kind === "memory" ? (
          <div className="mt-6">
            <DemoModeNote />
          </div>
        ) : null}
      </div>
    );
  }

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
            href="/explore"
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
      {repository.kind === "memory" ? (
        <div className="mt-8">
          <DemoModeNote />
        </div>
      ) : null}
    </div>
  );
}
