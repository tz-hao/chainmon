import Link from "next/link";
import { TeamEditor } from "@/components/TeamEditor";
import { requirePageTrainer } from "@/lib/auth/current-trainer";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { repository, trainer } = await requirePageTrainer();
  const monsters = await repository.listMonsters(trainer.id);
  const team = await repository.getTeam(trainer.id);

  type TeamMonster = (typeof monsters)[number];
  const initialTeam: (TeamMonster | null)[] = team
    ? [...team, null, null, null].slice(0, 3)
    : [null, null, null];

  return (
    <div className="animate-fade-in-up">
      <header className="mb-6 border-b-2 border-amber-300/70 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200">Squad terminal // battle ready</p>
            <h1 className="mt-1 text-2xl font-black uppercase tracking-[0.06em] text-slate-100 sm:text-3xl">Team</h1>
            <p className="mt-1 text-xs text-slate-400">Deploy three creatures. Their order becomes the opening battle formation.</p>
          </div>
          <div className="border border-slate-700 bg-[#081222] px-3 py-2 font-mono text-right">
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Available</p>
            <p className="mt-0.5 text-sm font-black text-slate-100">{monsters.length} units</p>
          </div>
        </div>
      </header>
      {monsters.length < 3 ? (
        <div className="mb-6 border border-amber-300/45 bg-amber-300/10 px-4 py-3">
          <p className="font-mono text-xs text-amber-100">
            You need at least 3 monsters to battle. You currently own{" "}
            {monsters.length}.
          </p>
          <Link
            href="/world/select"
            className="mt-3 inline-block border border-amber-200 bg-amber-300 px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.08em] text-slate-950 transition-colors hover:bg-amber-200"
          >
            Explore & Capture
          </Link>
        </div>
      ) : null}
      <TeamEditor
        monsters={monsters}
        initialTeam={initialTeam}
      />
    </div>
  );
}
