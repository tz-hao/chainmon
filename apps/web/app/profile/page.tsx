import { DemoModeNote } from "@/components/DemoModeNote";
import { PageHeader } from "@/components/PageHeader";
import { PhaseNote } from "@/components/PhaseNote";
import { getRepository } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const repository = await getRepository();
  const trainer = await repository.getDemoTrainer();

  return (
    <div className="mx-auto max-w-3xl animate-fade-in-up">
      <PageHeader
        title="Profile"
        subtitle="Your trainer identity, account and wallet settings."
        badge="Phase 2"
      />

      {/* Trainer card */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-2xl font-black text-slate-950">
            {trainer ? trainer.nickname.charAt(0).toUpperCase() : "?"}
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              {trainer?.nickname ?? "Unnamed Trainer"}
            </h2>
            <p className="text-sm text-slate-500">
              {trainer ? "Demo account — real auth in Phase 7" : "Trainer profile is created via /login"}
            </p>
          </div>
        </div>
        <dl className="mt-6 divide-y divide-slate-800">
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm text-slate-500">Nickname</dt>
            <dd className="text-sm font-medium text-slate-300">
              {trainer?.nickname ?? "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm text-slate-500">Email</dt>
            <dd className="text-sm font-medium text-slate-300">
              {trainer ? "demo@chainmon.local" : "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm text-slate-500">Wallet</dt>
            <dd className="text-sm font-medium text-slate-300">
              Not connected
            </dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm text-slate-500">Gold</dt>
            <dd className="text-sm font-medium text-slate-300">
              {trainer?.gold ?? 0}
            </dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm text-slate-500">Wins / Battles</dt>
            <dd className="text-sm font-medium text-slate-300">
              {trainer?.wins ?? 0} / {trainer?.battleCount ?? 0}
            </dd>
          </div>
        </dl>
      </section>

      {/* Account settings (placeholder) */}
      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Account Settings
        </h3>
        <div className="space-y-3">
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-lg bg-slate-800 px-4 py-2.5 text-left text-sm font-medium text-slate-500"
          >
            Change nickname
          </button>
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-lg bg-slate-800 px-4 py-2.5 text-left text-sm font-medium text-slate-500"
          >
            Link wallet
          </button>
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-lg bg-slate-800 px-4 py-2.5 text-left text-sm font-medium text-slate-500"
          >
            Sign out
          </button>
        </div>
      </section>

      {repository.kind === "memory" ? (
        <div className="mt-8">
          <DemoModeNote />
        </div>
      ) : (
        <div className="mt-8">
          <PhaseNote
            phase="Phase 7"
            text="Nickname editing and wallet linking arrive with real authentication."
          />
        </div>
      )}
    </div>
  );
}
