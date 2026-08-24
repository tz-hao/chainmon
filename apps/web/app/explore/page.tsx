import Link from "next/link";
import {
  getSpeciesById,
  REGIONS,
  type Region,
} from "@chainmon/monster-data";
import { DemoModeNote } from "@/components/DemoModeNote";
import { ElementBadge } from "@/components/ElementBadge";
import { EmptyState } from "@/components/EmptyState";
import { ExploreRegionForm } from "@/components/ExploreRegionForm";
import { InventoryStrip } from "@/components/InventoryStrip";
import { PageHeader } from "@/components/PageHeader";
import { getRepository } from "@/lib/data";

export const dynamic = "force-dynamic";

const REGION_ICONS: Record<string, string> = {
  forest: "🌲",
  lake: "🌊",
  volcano: "🌋",
  "power-plant": "⚡",
};

const RARITY_DOT: Record<string, string> = {
  common: "bg-slate-400",
  rare: "bg-sky-400",
  epic: "bg-purple-400",
  legendary: "bg-amber-400",
};

function RegionCard({ region }: { region: Region }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
            <span className="text-2xl">{REGION_ICONS[region.id]}</span>
            {region.name}
          </h2>
          <p className="mt-1 text-sm text-slate-400">{region.description}</p>
        </div>
        <ElementBadge element={region.mainElement} />
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Possible Monsters
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {region.encounters.map((entry) => {
          const species = getSpeciesById(entry.speciesId);
          if (!species) return null;
          return (
            <span
              key={entry.speciesId}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${RARITY_DOT[species.rarity]}`}
              />
              {species.name}
            </span>
          );
        })}
      </div>

      <ExploreRegionForm regionId={region.id} label={region.name} />
    </div>
  );
}

export default async function ExplorePage() {
  const repository = await getRepository();
  const trainer = await repository.getDemoTrainer();
  const inventory = trainer ? await repository.getInventory(trainer.id) : [];
  const activeEncounter = trainer
    ? await repository.getActiveEncounter(trainer.id)
    : null;

  if (!trainer) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader
          title="Explore"
          subtitle="Choose a zone and search for wild monsters."
          badge="Phase 3"
        />
        <EmptyState
          icon="🎒"
          title="No trainer yet"
          description="Create your trainer first, then head into the wild."
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

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Explore"
        subtitle="Choose a zone and search for wild monsters. Encounter odds follow each zone's population."
        badge="Phase 3"
      />

      <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
        <h2 className="text-xl font-bold text-emerald-200">Pixel World</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-300">
          Walk ChainMon Valley with WASD, spot wild monsters in the grass and
          capture them with your capsules.
        </p>
        <Link
          href="/world"
          className="mt-4 inline-block rounded-lg bg-emerald-500 px-8 py-3 text-base font-bold text-slate-950 transition-colors hover:bg-emerald-400"
        >
          ENTER WORLD →
        </Link>
      </div>

      {activeEncounter ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
          <p className="text-sm text-amber-200">
            A wild encounter is still active — {activeEncounter.speciesName}{" "}
            awaits you!
          </p>
          <Link
            href={`/encounter/${activeEncounter.id}`}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
          >
            Continue Encounter
          </Link>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        {REGIONS.map((region) => (
          <RegionCard key={region.id} region={region} />
        ))}
      </section>

      <div className="mt-8">
        <InventoryStrip inventory={inventory} />
      </div>

      {repository.kind === "memory" ? (
        <div className="mt-6">
          <DemoModeNote />
        </div>
      ) : null}
    </div>
  );
}
