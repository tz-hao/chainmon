import { PageHeader } from "@/components/PageHeader";
import { PhaseNote } from "@/components/PhaseNote";
import { AccountActions } from "@/components/AccountActions";
import { requirePageTrainer } from "@/lib/auth/current-trainer";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { repository, trainer } = await requirePageTrainer();
  const walletAddress = await repository.getVerifiedWallet(trainer.id);

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
            {trainer.nickname.charAt(0).toUpperCase()}
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              {trainer.nickname}
            </h2>
            <p className="text-sm text-slate-500">
              钱包登录 · 个人账户
            </p>
          </div>
        </div>
        <dl className="mt-6 divide-y divide-slate-800">
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm text-slate-500">Nickname</dt>
            <dd className="text-sm font-medium text-slate-300">
              {trainer.nickname}
            </dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm text-slate-500">Connected Wallet</dt>
            <dd className="text-sm font-medium text-slate-300">
              {walletAddress
                ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
                : "Unavailable"}
            </dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm text-slate-500">Gold</dt>
            <dd className="text-sm font-medium text-slate-300">
              {trainer.gold}
            </dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm text-slate-500">Wins / Battles</dt>
            <dd className="text-sm font-medium text-slate-300">
              {trainer.wins} / {trainer.battleCount}
            </dd>
          </div>
        </dl>
      </section>

      {/* Account settings (placeholder) */}
      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Account Settings
        </h3>
        <AccountActions />
      </section>

      <div className="mt-8">
        <PhaseNote
          phase="Wallet safety"
          text="钱包就是你的 ChainMon 账号。登录签名不会花费资产；普通游戏不需要 MON，链上功能会单独提示交易。"
        />
      </div>
    </div>
  );
}
