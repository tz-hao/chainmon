"use client";

import { useState } from "react";

interface ShopOverlayProps {
  trainerId: string;
  gold: number;
  onClose: () => void;
}

const SHOP_ITEMS = [
  { slug: "basic-ball", name: "Basic Capsule", price: 25 },
  { slug: "great-ball", name: "Great Capsule", price: 80 },
  { slug: "ultra-ball", name: "Ultra Capsule", price: 240 },
] as const;

/**
 * Ball Merchant — server-authoritative purchase (gold check + atomic
 * deduction + inventory grant happen in one DB transaction).
 */
export function ShopOverlay({ trainerId, gold, onClose }: ShopOverlayProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function purchase(slug: string, quantity: number) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/world/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainerId, itemSlug: slug, quantity }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Purchase failed.");
        return;
      }
      setMessage(`Bought ${quantity}× ${data.itemName}. Gold: ${data.goldAfter}`);
      window.dispatchEvent(
        new CustomEvent("world-toast", {
          detail: { message: `Bought ${quantity}× ${data.itemName}` },
        }),
      );
    } catch {
      setError("Purchase failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Ball Merchant</h2>
          <span className="text-sm text-amber-300">🪙 {gold}</span>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Capture Capsules — server-verified purchase, no client-side inventory edits.
        </p>

        <div className="mt-4 space-y-3">
          {SHOP_ITEMS.map((item) => (
            <div
              key={item.slug}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/50 p-3"
            >
              <div>
                <div className="text-sm font-semibold text-white">{item.name}</div>
                <div className="text-xs text-slate-400">{item.price} gold each</div>
              </div>
              <div className="flex gap-1">
                {[1, 5, 10].map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    disabled={busy}
                    onClick={() => void purchase(item.slug, qty)}
                    className="rounded border border-slate-600 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                  >
                    ×{qty} ({item.price * qty}g)
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {message ? <p className="mt-3 text-sm text-emerald-300">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-600"
        >
          Close
        </button>
      </div>
    </div>
  );
}
