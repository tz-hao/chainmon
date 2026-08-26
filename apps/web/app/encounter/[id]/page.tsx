import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpeciesById } from "@chainmon/monster-data";
import { EncounterPanel } from "@/components/EncounterPanel";
import { PageHeader } from "@/components/PageHeader";
import { requirePageTrainer } from "@/lib/auth/current-trainer";

export const dynamic = "force-dynamic";

interface EncounterPageProps {
  params: Promise<{ id: string }>;
}

export default async function EncounterPage({ params }: EncounterPageProps) {
  const { id } = await params;
  const { repository, trainer } = await requirePageTrainer();
  const encounter = await repository.getEncounterById(id);
  if (!encounter || encounter.trainerId !== trainer.id) {
    notFound();
  }

  const inventory = await repository.getInventory(trainer.id);
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
            href="/world/select"
            className="mt-6 inline-block rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
          >
            Back to Worlds
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
    </div>
  );
}
