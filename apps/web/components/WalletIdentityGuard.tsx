"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAccount, useDisconnect } from "wagmi";

interface SessionAccount {
  walletAddress: string;
}

interface InjectedProvider {
  on?(event: "accountsChanged", listener: (accounts: string[]) => void): void;
  removeListener?(event: "accountsChanged", listener: (accounts: string[]) => void): void;
}

/** Invalidates a ChainMon session as soon as a connected injected wallet changes. */
export function WalletIdentityGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const invalidating = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);

  const invalidateIfDifferentWallet = useCallback(async (nextAddress?: string) => {
    if (invalidating.current) return;
    try {
      const response = await fetch("/api/auth/me", { credentials: "same-origin" });
      const account = response.ok ? ((await response.json()) as SessionAccount) : null;
      if (!account?.walletAddress || (nextAddress && account.walletAddress.toLowerCase() === nextAddress.toLowerCase())) return;
      invalidating.current = true;
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      window.dispatchEvent(new Event("chainmon-session-cleared"));
      disconnect();
      setNotice("钱包已切换，请重新登录。");
      router.replace("/login");
      router.refresh();
    } catch {
      // An unavailable auth endpoint must not force a client-side disconnect.
    }
  }, [disconnect, router]);

  useEffect(() => {
    if (!isConnected || !address) return;
    void invalidateIfDifferentWallet(address);
  }, [address, invalidateIfDifferentWallet, isConnected, pathname]);

  useEffect(() => {
    const provider = (window as Window & { ethereum?: InjectedProvider }).ethereum;
    if (!provider) return;
    const onAccountsChanged = (accounts: string[]) => {
      void invalidateIfDifferentWallet(accounts[0]);
    };
    provider.on?.("accountsChanged", onAccountsChanged);

    return () => {
      provider.removeListener?.("accountsChanged", onAccountsChanged);
    };
  }, [invalidateIfDifferentWallet]);

  return notice ? (
    <p className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-amber-400/30 bg-slate-950 px-4 py-3 text-sm text-amber-100 shadow-xl">
      {notice}
    </p>
  ) : null;
}
