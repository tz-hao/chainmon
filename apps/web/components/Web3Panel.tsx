"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import type { Monster } from "@chainmon/shared";
import { BLOCK_EXPLORER_URL, CHAINMON_CHAIN_ID } from "@/lib/web3/chain";

interface ClaimResult {
  status: string;
  tokenId?: string;
  txHash?: string;
  recovered?: boolean;
  error?: string;
}

interface EvolveResult {
  status: string;
  txHash?: string;
  error?: string;
}

const STATUS_LABELS: Record<string, string> = {
  OFFCHAIN: "Off-chain",
  MINT_PENDING: "Preparing Mint",
  MINT_SUBMITTED: "Transaction Submitted",
  MINT_CONFIRMED: "Minted",
  MINT_FAILED: "Mint Failed",
};

/**
 * On-chain asset panel for a monster detail page (Phase 7).
 * Reads the mint state machine from the server; renders Claim / Refresh /
 * On-chain Evolution actions.
 */
export function Web3Panel({ monster }: { monster: Monster }) {
  const router = useRouter();
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChain, isPending: isSwitchingNetwork } = useSwitchChain();
  const [busy, setBusy] = useState<"claim" | "refresh" | "evolve" | null>(null);
  const [result, setResult] = useState<ClaimResult | EvolveResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = monster.mintStatus ?? "OFFCHAIN";
  const targetChainId = CHAINMON_CHAIN_ID;
  const wrongNetwork = isConnected && chainId !== targetChainId;
  async function run(path: string, body: object, kind: "claim" | "refresh" | "evolve") {
    setBusy(kind);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monsterId: monster.id, ...body }),
      });
      const data = (await res.json()) as ClaimResult & EvolveResult;
      if (!res.ok) {
        setError(data.error ?? "Blockchain temporarily unavailable.");
      } else {
        setResult(data);
        router.refresh();
      }
    } catch {
      setError("Blockchain temporarily unavailable.");
    } finally {
      setBusy(null);
    }
  }

  const explorerLink =
    BLOCK_EXPLORER_URL && result?.txHash
      ? `${BLOCK_EXPLORER_URL}/tx/${result.txHash}`
      : null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
        On-chain Asset
      </h2>

      {status === "MINT_CONFIRMED" && monster.tokenId ? (
        <div className="mt-4 space-y-2 text-sm">
          <p className="text-lg font-bold text-amber-300">
            NFT #{monster.tokenId}
          </p>
          {monster.ownershipMismatch ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              Ownership Mismatch — this NFT has been transferred outside
              ChainMon. Team / battle / evolution are restricted until resolved.
            </p>
          ) : (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              DNA Verified ✅ · Identity Verified ✅ (verified at claim /
              reconcile time)
            </p>
          )}
          <div className="flex justify-between">
            <dt className="text-slate-500">Chain ID</dt>
            <dd className="text-slate-300">{monster.mintChainId ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Contract</dt>
            <dd className="max-w-[60%] truncate text-slate-300">
              {monster.mintContractAddress ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">On-chain Owner</dt>
            <dd className="max-w-[60%] truncate text-slate-300">
              {monster.mintRecipient ?? "—"}
            </dd>
          </div>
          {monster.mintTxHash ? (
            <div className="flex justify-between">
              <dt className="text-slate-500">Tx</dt>
              <dd className="max-w-[60%] truncate text-sky-300">
                {explorerLink ? (
                  <a
                    href={explorerLink}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    View Transaction
                  </a>
                ) : (
                  <span>{monster.mintTxHash}</span>
                )}
              </dd>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-400">
            Status: <span className="font-semibold text-slate-200">{STATUS_LABELS[status]}</span>
            {status === "MINT_FAILED" && monster.mintError ? (
              <span className="block text-xs text-red-300">{monster.mintError}</span>
            ) : null}
          </p>
          <p className="text-xs text-slate-500">
            普通探索不需要 MON。只有你主动 Claim NFT 时才会进入 Monad 测试网
            流程，并显示一次明确的链上操作提示。
          </p>
          {wrongNetwork ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              <p>Claim NFT 是链上操作，请先切换到 Monad Testnet。</p>
              <button
                type="button"
                disabled={isSwitchingNetwork}
                onClick={() => switchChain({ chainId: targetChainId })}
                className="mt-2 rounded-md border border-red-400/40 px-2.5 py-1 font-semibold text-red-200 hover:bg-red-500/10 disabled:opacity-50"
              >
                {isSwitchingNetwork ? "切换中..." : "切换到 Monad Testnet"}
              </button>
            </div>
          ) : null}
          {(status === "OFFCHAIN" || status === "MINT_FAILED") && (
            <button
              type="button"
              disabled={busy !== null || wrongNetwork}
              onClick={() => run("/api/nft/claim", {}, "claim")}
              className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
            >
              {busy === "claim" ? "Claiming..." : "Claim NFT"}
            </button>
          )}
          {(status === "MINT_SUBMITTED" || status === "MINT_PENDING") && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run("/api/nft/refresh", {}, "refresh")}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800 disabled:opacity-50"
            >
              {busy === "refresh" ? "Refreshing..." : "Refresh Status"}
            </button>
          )}
        </div>
      )}

      {result?.status === "MINT_SUBMITTED" && result.txHash ? (
        <p className="mt-3 text-xs text-sky-300">
          Transaction submitted: {result.txHash.slice(0, 18)}... — refresh
          status after confirmation.
        </p>
      ) : null}

      {/* On-chain evolution sync (MINT_CONFIRMED monsters) */}
      {status === "MINT_CONFIRMED" ? (
        <div className="mt-5 border-t border-slate-800 pt-4">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run("/api/nft/evolve", {}, "evolve")}
            className="w-full rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
          >
            {busy === "evolve"
              ? "Submitting on-chain evolution..."
              : "On-chain Evolution"}
          </button>
          <p className="mt-2 text-xs text-slate-500">
            Evolution for minted monsters is executed on-chain first, then the
            game state is synced (level / item / route validated by the server).
          </p>
          {result && "status" in result && (result as EvolveResult).status ? (
            <p className="mt-2 text-xs text-amber-300">
              Evolution: {(result as EvolveResult).status.replace("_", " ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
