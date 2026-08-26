"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseEther } from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import monsterNftAbi from "../../../contracts/abis/MonsterNFT.json";
import monsterMarketplaceAbi from "../../../contracts/abis/MonsterMarketplace.json";
import type { Monster } from "@chainmon/shared";
import {
  MONSTER_MARKETPLACE_ADDRESS,
  MONSTER_NFT_ADDRESS,
  NATIVE_CURRENCY_SYMBOL,
} from "@/lib/web3/chain";
import type { MarketplaceListingRecord } from "@/lib/data";

interface SellPanelProps {
  monster: Monster;
  listing: MarketplaceListingRecord | null;
}

/**
 * Sell controls for a MINT_CONFIRMED monster (owner view).
 * Approve / List / Cancel are signed by the USER wallet (unlike NFT claim).
 */
export function SellPanel({ monster, listing }: SellPanelProps) {
  const router = useRouter();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { address, isConnected } = useAccount();
  const { switchChain, isPending: isSwitchingNetwork } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [priceEth, setPriceEth] = useState("");
  const [busy, setBusy] = useState<"approve" | "list" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const targetChainId = Number(
    process.env.NEXT_PUBLIC_CHAINMON_CHAIN_ID ?? 10143,
  );
  const wrongNetwork = isConnected && chainId !== targetChainId;
  const tokenId = BigInt(monster.tokenId ?? "0");

  function setErrorMsg(e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const lower = message.toLowerCase();
    if (lower.includes("user rejected") || lower.includes("user denied")) {
      setError("Transaction cancelled.");
    } else if (lower.includes("insufficient funds")) {
      setError(`Insufficient ${NATIVE_CURRENCY_SYMBOL} balance.`);
    } else {
      setError("The transaction failed. Please try again.");
    }
  }

  async function handleApprove() {
    if (!address) return;
    setBusy("approve");
    setError(null);
    try {
      const tx = await writeContractAsync({
        address: MONSTER_NFT_ADDRESS,
        abi: monsterNftAbi.abi as never,
        chainId: targetChainId,
        functionName: "approve",
        args: [MONSTER_MARKETPLACE_ADDRESS, tokenId],
      });
      const receipt = await publicClient?.waitForTransactionReceipt({ hash: tx });
      if (receipt?.status !== "success") throw new Error("approval reverted");
      const approved = await publicClient?.readContract({
        address: MONSTER_NFT_ADDRESS,
        abi: monsterNftAbi.abi as never,
        functionName: "getApproved",
        args: [tokenId],
      });
      setApprovalConfirmed(
        String(approved ?? "").toLowerCase() ===
          MONSTER_MARKETPLACE_ADDRESS.toLowerCase(),
      );
      setInfo("Approval confirmed.");
    } catch (e) {
      setErrorMsg(e);
    } finally {
      setBusy(null);
    }
  }

  async function handleList() {
    if (!address || !priceEth) return;
    setBusy("list");
    setError(null);
    try {
      let priceWei: bigint;
      try {
        priceWei = parseEther(priceEth);
      } catch {
        setError("Invalid price.");
        return;
      }
      if (priceWei <= 0n) {
        setError("Price must be greater than 0.");
        return;
      }
      const tx = await writeContractAsync({
        address: MONSTER_MARKETPLACE_ADDRESS,
        abi: monsterMarketplaceAbi.abi as never,
        chainId: targetChainId,
        functionName: "listMonster",
        args: [tokenId, priceWei],
      });
      const res = await fetch("/api/marketplace/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monsterId: monster.id,
          txHash: tx,
          priceWei: priceWei.toString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Listing failed");
      setInfo(
        data.status === "ACTIVE"
          ? "Listed for sale."
          : "Listing submitted — refreshing status will confirm it.",
      );
      router.refresh();
    } catch (e) {
      setErrorMsg(e);
    } finally {
      setBusy(null);
    }
  }

  async function handleCancel() {
    if (!address) return;
    setBusy("cancel");
    setError(null);
    try {
      const tx = await writeContractAsync({
        address: MONSTER_MARKETPLACE_ADDRESS,
        abi: monsterMarketplaceAbi.abi as never,
        chainId: targetChainId,
        functionName: "cancelListing",
        args: [tokenId],
      });
      const res = await fetch("/api/marketplace/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monsterId: monster.id,
          txHash: tx,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Cancel failed");
      setInfo("Listing cancelled.");
      router.refresh();
    } catch (e) {
      setErrorMsg(e);
    } finally {
      setBusy(null);
    }
  }

  if (monster.mintStatus !== "MINT_CONFIRMED" || !monster.tokenId) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Marketplace
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Claim NFT before selling.
        </p>
      </div>
    );
  }

  const active = listing?.status === "ACTIVE";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
        Marketplace
      </h2>

      {wrongNetwork ? (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <p>上架、取消和购买均是链上交易，请先切换到 Monad Testnet。</p>
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

      {active ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-300">
            Listed for sale ·{" "}
            <span className="font-bold text-amber-300">
              {listing?.priceWei
                ? (BigInt(listing.priceWei) / 10n ** 18n).toString()
                : "?"}{" "}
              {NATIVE_CURRENCY_SYMBOL}
            </span>
          </p>
          <p className="text-xs text-slate-500">
            Listed monsters cannot join teams, battle or evolve.
          </p>
          <button
            type="button"
            disabled={busy !== null || wrongNetwork}
            onClick={handleCancel}
            className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            {busy === "cancel" ? "Cancelling..." : "Cancel Listing"}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-slate-500">
            Sell this monster for fixed {NATIVE_CURRENCY_SYMBOL}. Transactions
            are signed by your wallet (marketplace is non-custodial, 0% fee).
          </p>
          <input
            type="text"
            inputMode="decimal"
            value={priceEth}
            onChange={(e) => setPriceEth(e.target.value)}
            placeholder={`Price in ${NATIVE_CURRENCY_SYMBOL} (e.g. 0.01)`}
            disabled={busy !== null || wrongNetwork}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none disabled:opacity-50"
          />
          {!approvalConfirmed ? (
            <button
              type="button"
              disabled={busy !== null || wrongNetwork || !isConnected}
              onClick={handleApprove}
              className="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50"
            >
              {busy === "approve"
                ? "Approving..."
                : "Approve NFT (marketplace)"}
            </button>
          ) : (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              Approval Confirmed
            </p>
          )}
          <button
            type="button"
            disabled={
              busy !== null || wrongNetwork || !isConnected || !approvalConfirmed
            }
            onClick={handleList}
            className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
          >
            {busy === "list" ? "Listing..." : "List Monster"}
          </button>
        </div>
      )}

      {info ? (
        <p className="mt-3 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-300">
          {info}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
