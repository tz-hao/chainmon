"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDisconnect } from "wagmi";

interface HeaderAccount {
  trainer: { nickname: string; gold: number };
  walletAddress: string | null;
}

export function AccountHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { disconnect } = useDisconnect();
  const [account, setAccount] = useState<HeaderAccount | null>(null);

  useEffect(() => {
    let active = true;
    const clearAccount = () => setAccount(null);
    window.addEventListener("chainmon-session-cleared", clearAccount);
    void fetch("/api/auth/me", { credentials: "same-origin" })
      .then(async (response) => (response.ok ? (response.json() as Promise<HeaderAccount>) : null))
      .then((nextAccount) => {
        if (active) setAccount(nextAccount);
      })
      .catch(() => {
        if (active) setAccount(null);
      });
    return () => {
      active = false;
      window.removeEventListener("chainmon-session-cleared", clearAccount);
    };
  }, [pathname]);

  async function signOut() {
    const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    if (!response.ok) return;
    window.dispatchEvent(new Event("chainmon-session-cleared"));
    disconnect();
    router.replace("/login");
    router.refresh();
  }

  if (!account) {
    return (
      <Link href="/login" className="rounded-xl border border-amber-200/30 bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 shadow-[0_8px_20px_rgba(251,191,36,0.16)] transition hover:-translate-y-0.5 hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">
        连接钱包
      </Link>
    );
  }
  const wallet = account.walletAddress;
  return (
    <div className="hidden items-center gap-2 lg:flex">
      <Link href="/profile" className="rounded-xl border border-slate-700/90 bg-slate-950/55 px-3 py-1.5 text-right text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition hover:border-cyan-300/35 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
        <span className="flex items-center justify-end gap-2 font-bold text-slate-100">
          <span>{account.trainer.nickname}</span>
          <span className="rounded-md border border-amber-200/15 bg-amber-300/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-200">G {account.trainer.gold}</span>
        </span>
        <span className="mt-0.5 block font-mono text-[10px] text-slate-500">{wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "Connected wallet"}</span>
      </Link>
      <button type="button" onClick={() => void signOut()} className="rounded-xl border border-slate-700/90 bg-slate-950/45 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:border-slate-500 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
        Logout
      </button>
    </div>
  );
}
