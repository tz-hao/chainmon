import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpeciesById } from "@chainmon/monster-data";
import { DemoModeNote } from "@/components/DemoModeNote";
import { EncounterPanel } from "@/components/EncounterPanel";
import { PageHeader } from "@/components/PageHeader";
import { getRepository } from "@/lib/data";

export const dynamic = "force-dynamic";

interface EncounterPageProps {
  params: { id: string };
}

export default async function EncounterPage({ params }: EncounterPageProps) {
  const repository = await getRepository();
  const encounter = await repository.getEncounterById(params.id);
  if (!encounter) {
    notFound();
  }

  const trainer = await repository.getDemoTrainer();
  const inventory = trainer ? await repository.getInventory(trainer.id) : [];
  const species = getSpeciesById(encounter.speciesId);

  if (encounter.status !== "active") {
    const captured = encounter.status === "captured";
    return (
      <div className="mx-auto max-w-2xl animate-fade-in-up">
        <PageHeader
          title="Encounter"
          subtitle="This encounter has ended."
          badge="Phase 3"
        />
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center">
          <div className="text-5xl">{captured ? "✅" : "💨"}</div>
          <h2 className="mt-3 text-xl font-bold text-slate-100">
            {captured ? "Monster Captured!" : "The monster fled."}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {captured
              ? "This wild monster is now part of your collection."
              : "You ran away. The wild monster is gone."}
          </p>
          <Link
            href="/explore"
            className="mt-6 inline-block rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
          >
            Back to Explore
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-in-up">
      <PageHeader
        title="Encounter"
        subtitle="Wild monsters can be caught with Capture Balls. Good luck!"
        badge="Phase 3"
      />
      <EncounterPanel
        encounter={encounter}
        species={species}
        inventory={inventory}
      />
      {repository.kind === "memory" ? (
        <div className="mt-6">
          <DemoModeNote />
        </div>
      ) : null}
    </div>
  );
}
