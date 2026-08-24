"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";

interface WalletStatus {
  trainerId: string | null;
  nickname: string | null;
  verified: boolean;
  walletAddress: string | null;
}

/**
 * Connect / verify wallet UI (injected wallets). Verification is a
 * signature-only challenge — no transaction, no gas.
 */
export function WalletButton() {
  const router = useRouter();
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet/status");
      if (res.ok) {
        setStatus((await res.json()) as WalletStatus);
      }
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus, isConnected]);

  const trainerId = status?.trainerId ?? null;
  const boundAddress = status?.walletAddress ?? null;
  const verified = status?.verified === true;

  async function handleVerify() {
    if (!address || !trainerId) return;
    setVerifying(true);
    setError(null);
    try {
      const challengeRes = await fetch("/api/wallet/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainerId, address }),
      });
      const challenge = (await challengeRes.json()) as {
        message?: string;
        error?: string;
      };
      if (!challengeRes.ok || !challenge.message) {
        throw new Error(challenge.error ?? "Could not create a challenge.");
      }

      const signature = await signMessageAsync({ message: challenge.message });

      const verifyRes = await fetch("/api/wallet/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainerId,
          message: challenge.message,
          signature,
          address,
        }),
      });
      const result = (await verifyRes.json()) as {
        walletAddress?: string;
        error?: string;
      };
      if (!verifyRes.ok) {
        throw new Error(result.error ?? "Verification failed.");
      }
      await loadStatus();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setVerifying(false);
    }
  }

  const shortAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const targetChainOk =
    chain?.id === Number(process.env.NEXT_PUBLIC_CHAINMON_CHAIN_ID ?? 31337);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {isConnected && address ? (
          <>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                targetChainOk
                  ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
                  : "bg-red-500/15 text-red-300 ring-1 ring-red-500/30"
              }`}
            >
              {targetChainOk ? `Chain ${chain?.id ?? "?"}` : "Wrong Network"}
            </span>
            <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200">
              {shortAddress(address)}
            </span>
            {verified && boundAddress === address.toLowerCase() ? (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                Verified
              </span>
            ) : (
              <button
                type="button"
                onClick={handleVerify}
                disabled={verifying || !trainerId}
                className="rounded-full bg-amber-500 px-2.5 py-1 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
              >
                {verifying ? "Signing..." : "Verify Wallet"}
              </button>
            )}
            <button
              type="button"
              onClick={() => disconnect()}
              className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-400 transition-colors hover:text-slate-200"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => connect({ connector: connectors[0] })}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-700"
          >
            Connect Wallet
          </button>
        )}
      </div>
      {!targetChainOk && isConnected ? (
        <p className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          Wrong network — switch to chain{" "}
          {Number(process.env.NEXT_PUBLIC_CHAINMON_CHAIN_ID ?? 31337)} to claim
          NFTs.
        </p>
      ) : null}
      {error ? (
        <p className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}
      {isConnected && address && boundAddress && boundAddress !== address.toLowerCase() ? (
        <p className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Bound wallet {shortAddress(boundAddress)} differs from the connected
          wallet. Wallet rebinding is not supported yet.
        </p>
      ) : null}
    </div>
  );
}
