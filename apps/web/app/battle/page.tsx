import Link from "next/link";
import { PixelMonster } from "@/components/PixelMonster";
import { StartBattleButton } from "@/components/StartBattleButton";
import { requirePageTrainer } from "@/lib/auth/current-trainer";

export const dynamic = "force-dynamic";

function resultLabel(winner: string | undefined): string {
  if (winner === "player") return "Victory";
  if (winner === "opponent") return "Defeat";
  return "In progress";
}

export default async function BattlePage() {
  const { repository, trainer } = await requirePageTrainer();
  const team = await repository.getTeam(trainer.id);
  const history = await repository.getTrainerBattles(trainer.id, 8);
  return (
    <div className="space-y-5 animate-fade-in-up">
      <section className="border-2 border-slate-700 bg-[#07101f]" aria-labelledby="battle-title">
        <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
          <div>
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">Battle terminal // 3v3 protocol</p>
            <h1 id="battle-title" className="mt-1 font-mono text-2xl font-black uppercase tracking-[0.04em] text-slate-100">Field battle</h1>
          </div>
          <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-slate-500">{trainer.nickname} · AI opponent queued</p>
        </div>
        <p className="px-4 py-3 text-xs leading-5 text-slate-400 sm:px-5">Deploy the exact three-member squad, resolve one turn at a time, and review the record below.</p>
      </section>

      {team && team.length === 3 ? (
        <section className="border border-slate-700 bg-[#07101f]" aria-labelledby="battle-team-title">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 sm:px-5">
            <div><p className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Deployment line</p><h2 id="battle-team-title" className="mt-1 font-mono text-sm font-black uppercase text-slate-100">Your battle team</h2></div>
            <p className="font-mono text-[9px] font-black uppercase tracking-[0.1em] text-amber-200">3 / 3 ready</p>
          </div>
          <div className="grid gap-2 p-4 sm:grid-cols-3 sm:p-5">
            {team.map((monster, index) => (
              <div key={monster.id} className="flex min-h-20 items-center gap-3 border border-slate-700 bg-[#050b17] p-3">
                <span className="border border-slate-700 px-2 py-1 font-mono text-[10px] font-black text-slate-500">0{index + 1}</span>
                <PixelMonster speciesId={monster.speciesId} alt="" decorative variant="battle-front" className="h-16 w-16" />
                <div className="min-w-0"><p className="truncate font-mono text-sm font-black uppercase text-slate-100">{monster.name}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-slate-500">Lv {monster.level} · HP {monster.hp} · ATK {monster.attack}</p></div>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-800 p-4 sm:p-5"><StartBattleButton /></div>
        </section>
      ) : (
        <section className="border border-dashed border-slate-700 bg-[#07101f] px-4 py-8 text-center sm:px-5">
          <p className="font-mono text-sm font-black uppercase text-slate-200">Three creatures required</p>
          <p className="mt-2 text-xs text-slate-500">Build an exact three-member team before opening a battle terminal.</p>
          <Link href="/team" className="mt-4 inline-flex border border-amber-300 bg-amber-300 px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.12em] text-slate-950 transition-colors hover:bg-amber-200">Build team</Link>
        </section>
      )}

      <section className="border border-slate-700 bg-[#07101f]" aria-labelledby="battle-history-title">
        <div className="flex items-end justify-between border-b border-slate-800 px-4 py-3 sm:px-5">
          <div><p className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Archive</p><h2 id="battle-history-title" className="mt-1 font-mono text-sm font-black uppercase text-slate-100">Recent battles</h2></div>
          <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-slate-500">Latest 8</p>
        </div>
        {history.length === 0 ? (
          <p className="px-4 py-8 text-center font-mono text-xs text-slate-500">NO RECORDS YET // OPEN THE FIRST 3V3 MATCH</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left font-mono text-xs">
              <thead className="border-b border-slate-800 text-[9px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-4 py-3 font-black">Result</th><th className="px-4 py-3 font-black">Turns</th><th className="px-4 py-3 font-black">Created</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {history.map((battle) => (
                  <tr key={battle.id} className="bg-[#050b17] transition-colors hover:bg-slate-900">
                    <td className="px-4 py-3"><Link href={`/battle/${battle.id}`} className={battle.winner === "player" ? "font-black uppercase text-emerald-300" : battle.winner === "opponent" ? "font-black uppercase text-rose-300" : "font-black uppercase text-amber-200"}>{resultLabel(battle.winner)}</Link></td>
                    <td className="px-4 py-3 text-slate-400">{battle.turn}</td>
                    <td className="px-4 py-3 text-slate-500">{battle.createdAt.toLocaleString()}</td>
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
