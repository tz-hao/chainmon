import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpeciesById } from "@chainmon/monster-data";
import { EncounterPanel } from "@/components/EncounterPanel";
import { requirePageTrainer } from "@/lib/auth/current-trainer";

export const dynamic = "force-dynamic";

interface EncounterPageProps {
  params: Promise<{ id: string }>;
}

export default async function EncounterPage({ params }: EncounterPageProps) {
  const { id } = await params;
  const { repository, trainer } = await requirePageTrainer();
  const encounter = await repository.getEncounterById(id);
  if (!encounter || encounter.trainerId !== trainer.id) notFound();
  const inventory = await repository.getInventory(trainer.id);
  const species = getSpeciesById(encounter.speciesId);

  if (encounter.status !== "active") {
    const captured = encounter.status === "captured";
    return (
      <div className="mx-auto max-w-4xl animate-fade-in-up">
        <section className={`border-2 p-6 text-center ${captured ? "border-emerald-400/70 bg-emerald-400/5" : "border-slate-700 bg-[#07101f]"}`}>
          <p className={`font-mono text-[10px] font-black uppercase tracking-[0.18em] ${captured ? "text-emerald-300" : "text-slate-500"}`}>{captured ? "Capture confirmed" : "Encounter closed"}</p>
          <h1 className="mt-2 font-mono text-2xl font-black uppercase text-slate-100">{captured ? "Monster captured" : "The wild creature fled"}</h1>
          <p className="mt-2 text-xs text-slate-400">{captured ? "This creature is now part of your collection." : "Return to the world selector to find another wild signal."}</p>
          <Link href="/world/select" className="mt-5 inline-flex border border-amber-300 bg-amber-300 px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-slate-950 transition-colors hover:bg-amber-200">Back to worlds</Link>
        </section>
      </div>
    );
  }

  return <div className="mx-auto max-w-4xl animate-fade-in-up"><EncounterPanel encounter={encounter} species={species} inventory={inventory} /></div>;
}
