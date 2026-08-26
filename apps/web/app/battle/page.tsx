import Link from "next/link";
import { MONSTER_SPECIES } from "@chainmon/monster-data";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StartBattleButton } from "@/components/StartBattleButton";
import { requirePageTrainer } from "@/lib/auth/current-trainer";
import { getMonsterVisualPath } from "@/lib/world/monster-visuals";

export const dynamic = "force-dynamic";

function resultLabel(winner: string | undefined): string {
  if (winner === "player") return "Victory";
  if (winner === "opponent") return "Defeat";
  return "In Progress";
}

export default async function BattlePage() {
  const { repository, trainer } = await requirePageTrainer();
  const team = await repository.getTeam(trainer.id);
  const history = await repository.getTrainerBattles(trainer.id, 8);
  const speciesImages = Object.fromEntries(
    MONSTER_SPECIES.map((species) => [species.id, getMonsterVisualPath(species.id, "portrait")]),
  ) as Record<number, string>;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Battle"
        subtitle="Take on an AI trainer in a 3v3 turn-based battle."
        badge="Phase 4"
      />

      {team && team.length === 3 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Your Battle Team
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {team.map((monster, index) => (
              <div
                key={monster.id}
                className="flex items-center gap-3 rounded-xl bg-slate-800/60 p-3"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-900 text-xs font-bold text-slate-400">
                  {index + 1}
                </span>
                <img
                  src={
                    speciesImages[monster.speciesId] ??
                    "/monsters/placeholder.svg"
                  }
                  alt=""
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-lg bg-slate-950/40 object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-200">
                    {monster.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    Lv {monster.level} · HP {monster.hp} · ATK {monster.attack}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <StartBattleButton />
          </div>
        </div>
      ) : (
        <EmptyState
          icon="🛡️"
          title="Complete your 3-monster team first"
          description="You need at least 3 monsters to battle. Select exactly three from your collection."
          action={
            <Link
              href="/team"
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
            >
              Build Team
            </Link>
          }
        />
      )}

      {/* Recent battles */}
      <section className="mt-10">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Recent Battles
        </h2>
        {history.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-10 text-center text-sm text-slate-400">
            No battles yet — start your first 3v3 battle!
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">Turns</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {history.map((battle) => (
                  <tr
                    key={battle.id}
                    className="bg-slate-900/40 transition-colors hover:bg-slate-900"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/battle/${battle.id}`}
                        className={`font-semibold ${
                          battle.winner === "player"
                            ? "text-emerald-300"
                            : battle.winner === "opponent"
                              ? "text-red-300"
                              : "text-slate-300"
                        }`}
                      >
                        {resultLabel(battle.winner)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{battle.turn}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {battle.createdAt.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  );
}
