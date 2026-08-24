import Link from "next/link";
import { getStarters } from "@chainmon/monster-data";
import { DemoModeNote } from "@/components/DemoModeNote";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { PageHeader } from "@/components/PageHeader";
import { getRepository } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const repository = await getRepository();
  const trainer = await repository.getDemoTrainer();
  const monsters = trainer ? await repository.listMonsters() : [];
  const starters = getStarters();

  return (
    <div className="mx-auto max-w-5xl animate-fade-in-up">
      <PageHeader
        title="Sign In / Create Trainer"
        subtitle="Phase 2 demo flow — create your trainer and pick a starter monster. Real authentication arrives in Phase 7."
        badge="Phase 2: Demo"
      />

      {trainer ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center">
          <div className="text-4xl">🎒</div>
          <h2 className="mt-3 text-xl font-bold text-slate-100">
            Welcome back, {trainer.nickname}!
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            You are signed in with the demo account{" "}
            <code className="text-slate-300">demo@chainmon.local</code> and own{" "}
            {monsters.length} monster{monsters.length === 1 ? "" : "s"}.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/monsters"
              className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
            >
              View Collection
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-700 bg-slate-800/60 px-5 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800"
            >
              Dashboard
            </Link>
          </div>
        </div>
      ) : (
        <OnboardingFlow starters={starters} />
      )}

      {repository.kind === "memory" ? (
        <div className="mt-8">
          <DemoModeNote />
        </div>
      ) : null}
    </div>
  );
}
