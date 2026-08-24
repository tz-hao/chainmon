import Link from "next/link";
import { notFound } from "next/navigation";
import { MONSTER_SPECIES } from "@chainmon/monster-data";
import { BattleArena } from "@/components/BattleArena";
import { DemoModeNote } from "@/components/DemoModeNote";
import { PageHeader } from "@/components/PageHeader";
import { getRepository } from "@/lib/data";
import { BattleError, getBattle } from "@/lib/services/battle-service";
import { getMonsterVisualPath } from "@/lib/world/monster-visuals";

export const dynamic = "force-dynamic";

interface BattleArenaPageProps {
  params: { id: string };
}

export default async function BattleArenaPage({
  params,
}: BattleArenaPageProps) {
  const repository = await getRepository();
  const trainer = await repository.getDemoTrainer();

  let record;
  try {
    record = trainer
      ? await getBattle(repository, trainer.id, params.id)
      : null;
  } catch (error) {
    if (error instanceof BattleError) {
      notFound();
    }
    throw error;
  }
  if (!record) {
    notFound();
  }

  const speciesImages = Object.fromEntries(
    MONSTER_SPECIES.map((species) => [species.id, getMonsterVisualPath(species.id, "battle-front")]),
  ) as Record<number, string>;

  return (
    <div className="mx-auto max-w-3xl animate-fade-in-up">
      <PageHeader
        title="Battle Arena"
        subtitle="Server-authoritative 3v3 battle — every action is resolved on the server."
        badge="Phase 4"
      />
      <Link
        href="/battle"
        className="text-sm text-slate-400 transition-colors hover:text-slate-200"
      >
        ← Back to battles
      </Link>
      <div className="mt-4">
        <BattleArena
          initialState={record.state}
          initialLogs={record.logs}
          speciesImages={speciesImages}
          initialRewards={record.rewards ?? null}
        />
      </div>
      {repository.kind === "memory" ? (
        <div className="mt-6">
          <DemoModeNote />
        </div>
      ) : null}
    </div>
  );
}
