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
      <Link href="/login" className="hidden border border-amber-300/80 bg-amber-300 px-2.5 py-1.5 font-mono text-[10px] font-black uppercase tracking-[0.08em] text-slate-950 transition-colors hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 lg:inline-flex">
        连接钱包
      </Link>
    );
  }
  const wallet = account.walletAddress;
  return (
    <div className="hidden items-center gap-2 lg:flex">
      <Link href="/profile" className="border border-slate-700 bg-[#050b17] px-2.5 py-1.5 text-right text-xs transition hover:border-amber-300/60 hover:bg-[#0a1426] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">
        <span className="flex items-center justify-end gap-2 font-bold text-slate-100">
          <span>{account.trainer.nickname}</span>
          <span className="rounded-md border border-amber-200/15 bg-amber-300/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-200">G {account.trainer.gold}</span>
        </span>
        <span className="mt-0.5 block font-mono text-[10px] text-slate-500">{wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "Connected wallet"}</span>
      </Link>
      <button type="button" onClick={() => void signOut()} className="border border-slate-700 bg-[#050b17] px-2.5 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 transition hover:border-slate-500 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">
        Logout
      </button>
    </div>
  );
}
