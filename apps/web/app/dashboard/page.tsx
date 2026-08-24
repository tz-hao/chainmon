import Link from "next/link";
import { BlockchainStatus } from "@/components/BlockchainStatus";
import { DemoModeNote } from "@/components/DemoModeNote";
import { PageHeader } from "@/components/PageHeader";
import { PhaseNote } from "@/components/PhaseNote";
import { StatCard } from "@/components/StatCard";
import { getRepository } from "@/lib/data";

const ENTRIES = [
  {
    href: "/explore",
    icon: "🗺️",
    title: "Explore",
    text: "Head into the wild and encounter monsters.",
    phase: "Phase 3",
  },
  {
    href: "/battle",
    icon: "⚔️",
    title: "Battle",
    text: "Take on trainers in 3v3 turn-based battles.",
    phase: "Phase 4",
  },
  {
    href: "/monsters",
    icon: "🐾",
    title: "Monsters",
    text: "Browse your collection and monster details.",
    phase: "Ready",
  },
  {
    href: "/marketplace",
    icon: "🏪",
    title: "Marketplace",
    text: "List, buy and trade monster NFTs.",
    phase: "Phase 8",
  },
] as const;

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const repository = await getRepository();
  const trainer = await repository.getDemoTrainer();
  const monsters = trainer ? await repository.listMonsters() : [];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Dashboard"
        subtitle={
          trainer
            ? `Trainer ${trainer.nickname} — live data.`
            : "Your trainer overview. Create a trainer to see live data."
        }
        badge="Phase 2"
      />

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Trainer"
          value={trainer?.nickname ?? "—"}
          hint={trainer ? "Demo account" : "Create one via /login"}
        />
        <StatCard
          label="Wallet"
          value="Not connected"
          hint="Privy + wagmi in Phase 7"
        />
        <StatCard
          label="Gold"
          value={trainer?.gold ?? 0}
          hint="Earned from battles"
        />
        <StatCard label="Monsters" value={monsters.length} hint="Captured & owned" />
        <StatCard
          label="Wins"
          value={trainer?.wins ?? 0}
          hint="Battle victories"
        />
        <StatCard
          label="Battles"
          value={trainer?.battleCount ?? 0}
          hint="Total 3v3 battles"
        />
      </section>

      {/* Entry cards */}
      <section className="mt-10">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Quick Access
        </h2>

        {/* Primary CTA: the Pixel World is the main gameplay entry */}
        <Link
          href="/world"
          className="mb-4 flex items-center justify-between rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6 transition-colors hover:bg-emerald-500/20"
        >
          <div>
            <h3 className="text-xl font-bold text-emerald-200">ENTER WORLD</h3>
            <p className="mt-1 text-sm text-slate-300">
              Walk ChainMon Valley, spot wild monsters and capture them with
              your capsules.
            </p>
          </div>
          <span className="text-3xl">🌍</span>
        </Link>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {ENTRIES.map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition-colors hover:border-amber-500/40 hover:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl">{entry.icon}</span>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                  {entry.phase}
                </span>
              </div>
              <h3 className="mt-3 font-semibold text-slate-100 group-hover:text-amber-300">
                {entry.title}
              </h3>
              <p className="mt-1 text-sm text-slate-400">{entry.text}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Blockchain status (Phase 7) */}
      <section className="mt-10">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Web3
        </h2>
        <div className="max-w-md">
          <BlockchainStatus />
        </div>
      </section>

      {repository.kind === "memory" ? (
        <div className="mt-10">
          <DemoModeNote />
        </div>
      ) : (
        <div className="mt-10">
          <PhaseNote
            phase="Phase 5"
            text="Trainer and monster counts are now live. Gold / wins / battles stay at 0 until the battle system lands in Phase 4."
          />
        </div>
      )}
    </div>
  );
}
