import Link from "next/link";
import { notFound } from "next/navigation";
import { BattleArena } from "@/components/BattleArena";
import { requirePageTrainer } from "@/lib/auth/current-trainer";
import { BattleError, getBattle } from "@/lib/services/battle-service";

export const dynamic = "force-dynamic";

interface BattleArenaPageProps {
  params: Promise<{ id: string }>;
}

export default async function BattleArenaPage({ params }: BattleArenaPageProps) {
  const { id } = await params;
  const { repository, trainer } = await requirePageTrainer();

  let record;
  try {
    record = await getBattle(repository, trainer.id, id);
  } catch (error) {
    if (error instanceof BattleError) notFound();
    throw error;
  }
  if (!record) notFound();

  return (
    <div className="space-y-4 animate-fade-in-up">
      <section className="border-2 border-slate-700 bg-[#07101f]" aria-labelledby="battle-arena-page-title">
        <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
          <div>
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">Battle terminal // live match</p>
            <h1 id="battle-arena-page-title" className="mt-1 font-mono text-2xl font-black uppercase tracking-[0.04em] text-slate-100">Battle arena</h1>
          </div>
          <Link href="/battle" className="border border-slate-600 bg-[#050b17] px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.12em] text-slate-300 transition-colors hover:border-amber-300 hover:text-amber-100">Back to battles</Link>
        </div>
        <p className="px-4 py-3 text-xs text-slate-400 sm:px-5">One command resolves one exchange. The battle feed records the server-authoritative result.</p>
      </section>
      <BattleArena initialState={record.state} initialLogs={record.logs} initialRewards={record.rewards ?? null} />
    </div>
  );
}
