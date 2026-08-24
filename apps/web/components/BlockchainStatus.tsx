"use client";

import { useEffect, useState } from "react";

interface HealthState {
  connected: boolean;
  chainId?: number;
  contractAddress?: string | null;
  contractVersion?: string;
  backendAddress?: string;
  minterRole?: boolean;
  evolverRole?: boolean;
  reason?: string;
}

/** Dashboard blockchain status card (graceful when RPC is down). */
export function BlockchainStatus() {
  const [health, setHealth] = useState<HealthState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/web3/health")
      .then((res) => res.json())
      .then((data: HealthState) => {
        if (!cancelled) setHealth(data);
      })
      .catch(() => {
        if (!cancelled) setHealth({ connected: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className={`rounded-xl border p-4 ${
        health?.connected
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-slate-800 bg-slate-900/60"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
        Blockchain
      </p>
      {health === null ? (
        <p className="mt-2 text-sm text-slate-400">Checking...</p>
      ) : health.connected ? (
        <div className="mt-2 space-y-1 text-sm">
          <p className="flex items-center gap-2 font-semibold text-emerald-300">
            <span>●</span> Connected
          </p>
          <p className="text-slate-400">
            Chain: <span className="text-slate-200">{health.chainId}</span>
            {health.contractVersion
              ? ` · MonsterNFT v${health.contractVersion}`
              : ""}
          </p>
          <p className="truncate text-xs text-slate-500">
            MonsterNFT:{" "}
            {health.contractAddress
              ? `${health.contractAddress.slice(0, 10)}...${health.contractAddress.slice(-6)}`
              : "—"}
          </p>
          <p className="text-xs text-slate-500">
            Backend: {health.backendAddress?.slice(0, 10)}... · MINTER{" "}
            {health.minterRole ? "✅" : "❌"} · EVOLVER{" "}
            {health.evolverRole ? "✅" : "❌"}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-amber-300/90">
          Blockchain temporarily unavailable
          {health.reason ? <span className="block text-xs text-slate-500">{health.reason}</span> : null}
        </p>
      )}
    </div>
  );
}
