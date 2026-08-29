import Link from "next/link";
import { notFound } from "next/navigation";
import { MONSTER_SPECIES } from "@chainmon/monster-data";
import { BattleArena } from "@/components/BattleArena";
import { PageHeader } from "@/components/PageHeader";
import { requirePageTrainer } from "@/lib/auth/current-trainer";
import { BattleError, getBattle } from "@/lib/services/battle-service";
import { getMonsterVisualPath } from "@/lib/world/monster-visuals";

export const dynamic = "force-dynamic";

interface BattleArenaPageProps {
  params: Promise<{ id: string }>;
}

export default async function BattleArenaPage({
  params,
}: BattleArenaPageProps) {
  const { id } = await params;
  const { repository, trainer } = await requirePageTrainer();

  let record;
  try {
    record = await getBattle(repository, trainer.id, id);
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
        subtitle="3v3 battle — resolve one clear command at a time."
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
    </div>
  );
}
