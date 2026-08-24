"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import monsterMarketplaceAbi from "../../../contracts/abis/MonsterMarketplace.json";
import {
  MONSTER_MARKETPLACE_ADDRESS,
  NATIVE_CURRENCY_SYMBOL,
} from "@/lib/web3/chain";
import { ElementBadge } from "./ElementBadge";
import { RarityBadge } from "./RarityBadge";

interface ListingView {
  id: string;
  monsterId: string;
  sellerId: string;
  tokenId?: string;
  priceWei: string;
  priceEth: string;
  status: string;
  listingTxHash?: string;
  buyerWallet?: string;
  monster: {
    id: string;
    tokenId?: string;
    speciesId: number;
    name: string;
    element: "fire" | "water" | "nature" | "electric";
    rarity: "common" | "rare" | "epic" | "legendary";
    level: number;
    hp: number;
    attack: number;
    defense: number;
    speed: number;
    generation: number;
    wins: number;
    battleCount: number;
  };
}

export type { ListingView };

interface MarketplacePageProps {
  trainerId: string | null;
  initialListings: ListingView[];
}

type Tab = "for-sale" | "mine";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  ACTIVE: "Active",
  CANCEL_PENDING: "Cancelling",
  CANCELLED: "Cancelled",
  SALE_PENDING: "Selling",
  SOLD: "Sold",
  STALE: "Stale",
  FAILED: "Failed",
};

export function MarketplacePage({
  trainerId,
  initialListings,
}: MarketplacePageProps) {
  const router = useRouter();
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [tab, setTab] = useState<Tab>("for-sale");
  const [listings, setListings] = useState<ListingView[]>(initialListings);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const targetChainId = Number(
    process.env.NEXT_PUBLIC_CHAINMON_CHAIN_ID ?? 31337,
  );
  const wrongNetwork = isConnected && chainId !== targetChainId;

  async function load() {
    try {
      const url = tab === "mine" && trainerId
        ? `/api/marketplace/listings?trainerId=${encodeURIComponent(trainerId)}`
        : "/api/marketplace/listings";
      const res = await fetch(url);
      if (!res.ok) throw new Error("unavailable");
      const data = (await res.json()) as { listings: ListingView[] };
      setListings(data.listings);
      setError(null);
    } catch {
      setError("Marketplace temporarily unavailable.");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function handleBuy(listing: ListingView) {
    if (!address || !listing.tokenId) return;
    setBusyId(listing.id);
    setError(null);
    try {
      const tx = await writeContractAsync({
        address: MONSTER_MARKETPLACE_ADDRESS,
        abi: monsterMarketplaceAbi.abi as never,
        chainId: targetChainId,
        functionName: "buyMonster",
        args: [BigInt(listing.tokenId)],
        value: BigInt(listing.priceWei),
      });
      const res = await fetch("/api/marketplace/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainerId,
          monsterId: listing.monsterId,
          txHash: tx,
          buyerWallet: address,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Purchase failed");
      setError(null);
      router.refresh();
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const lower = message.toLowerCase();
      setError(
        lower.includes("user rejected") || lower.includes("user denied")
          ? "Transaction cancelled."
          : "The purchase failed. Please try again.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(listing: ListingView) {
    if (!address) return;
    setBusyId(listing.id);
    setError(null);
    try {
      if (!listing.tokenId) throw new Error("no token id");
      const tx = await writeContractAsync({
        address: MONSTER_MARKETPLACE_ADDRESS,
        abi: monsterMarketplaceAbi.abi as never,
        chainId: targetChainId,
        functionName: "cancelListing",
        args: [BigInt(listing.tokenId)],
      });
      const res = await fetch("/api/marketplace/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainerId,
          monsterId: listing.monsterId,
          txHash: tx,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Cancel failed");
      router.refresh();
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(
        message.toLowerCase().includes("user rejected")
          ? "Transaction cancelled."
          : "The cancel failed. Please try again.",
      );
    } finally {
      setBusyId(null);
    }
  }

  const myActive =
    tab === "mine"
      ? listings.filter((l) =>
          ["PENDING", "ACTIVE", "CANCEL_PENDING", "SALE_PENDING", "SOLD"].includes(
            l.status,
          ),
        )
      : [];

  return (
    <div>
      <div className="mb-6 flex gap-2 border-b border-slate-800">
        {(
          [
            ["for-sale", "For Sale"],
            ["mine", "My Listings"],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              tab === value
                ? "border-amber-500 text-amber-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {wrongNetwork ? (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          Wrong network — switch to chain {targetChainId} to trade.
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {error}
        </p>
      ) : null}

      {listings.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-16 text-center text-sm text-slate-400">
          {tab === "for-sale"
            ? "No monsters are listed for sale right now."
            : "You have no marketplace listings."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <div
              key={listing.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
            >
              <img
                src={`/monsters/${listing.monster.speciesId}.svg`}
                alt=""
                width={64}
                height={64}
                className="h-16 w-16 rounded-xl bg-slate-950/40 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "/monsters/placeholder.svg";
                }}
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="font-bold text-slate-100">
                  {listing.monster.name}
                </p>
                <span className="text-xs text-slate-500">
                  NFT #{listing.monster.tokenId ?? "?"}
                </span>
              </div>
              <div className="mt-1 flex gap-1.5">
                <ElementBadge element={listing.monster.element} />
                <span className="self-center text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Species rarity
                </span>
                <RarityBadge rarity={listing.monster.rarity} />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Lv {listing.monster.level} · HP {listing.monster.hp} · ATK{" "}
                {listing.monster.attack} · DEF {listing.monster.defense} · SPD{" "}
                {listing.monster.speed}
              </p>
              <p className="text-xs text-slate-500">
                Gen {listing.monster.generation} · {listing.monster.wins}W /{" "}
                {listing.monster.battleCount}B
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-bold text-amber-300">
                  {listing.priceEth} {NATIVE_CURRENCY_SYMBOL}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                    listing.status === "ACTIVE"
                      ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                      : "bg-slate-500/15 text-slate-400 ring-slate-500/30"
                  }`}
                >
                  {STATUS_LABELS[listing.status] ?? listing.status}
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                {tab === "for-sale" && listing.status === "ACTIVE" ? (
                  <button
                    type="button"
                    disabled={busyId !== null || wrongNetwork || !isConnected}
                    onClick={() => handleBuy(listing)}
                    className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
                  >
                    {busyId === listing.id ? "Buying..." : "Buy"}
                  </button>
                ) : null}
                {tab === "mine" && listing.status === "ACTIVE" ? (
                  <button
                    type="button"
                    disabled={busyId !== null || wrongNetwork}
                    onClick={() => handleCancel(listing)}
                    className="flex-1 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
                  >
                    {busyId === listing.id ? "Cancelling..." : "Cancel"}
                  </button>
                ) : null}
                {tab === "mine" ? (
                  <Link
                    href={`/monsters/${listing.monsterId}`}
                    className="flex-1 rounded-lg border border-slate-700 px-3 py-2 text-center text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800"
                  >
                    View
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
