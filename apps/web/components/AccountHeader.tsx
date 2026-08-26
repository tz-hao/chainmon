"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDisconnect } from "wagmi";

interface HeaderAccount {
  trainer: { nickname: string; gold: number };
  walletAddress: string | null;
}

export function AccountHeader() {
  const router = useRouter();
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
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    window.dispatchEvent(new Event("chainmon-session-cleared"));
    disconnect();
    router.replace("/login");
    router.refresh();
  }

  if (!account) {
    return (
      <Link href="/login" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400">
        连接钱包
      </Link>
    );
  }
  const wallet = account.walletAddress;
  return (
    <div className="hidden items-center gap-2 lg:flex">
      <Link href="/profile" className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-right text-xs hover:bg-slate-800">
        <span className="block font-bold text-slate-100">{account.trainer.nickname} · 🪙 {account.trainer.gold}</span>
        <span className="block text-slate-400">{wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "Connected wallet"}</span>
      </Link>
      <button type="button" onClick={() => void signOut()} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800">
        Logout
      </button>
    </div>
  );
}
