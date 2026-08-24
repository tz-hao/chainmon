import { CAPTURE_BALLS } from "@chainmon/game-engine";
import type { InventoryEntry } from "@/lib/data";

interface InventoryStripProps {
  inventory: InventoryEntry[];
}

export function InventoryStrip({ inventory }: InventoryStripProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
        Backpack
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {CAPTURE_BALLS.map((ball) => {
          const entry = inventory.find((item) => item.slug === ball.slug);
          const quantity = entry?.quantity ?? 0;
          return (
            <div
              key={ball.slug}
              className="flex items-center justify-between rounded-xl bg-slate-800/60 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-slate-200">
                  {ball.name}
                </p>
                <p className="text-xs text-slate-500">
                  {ball.modifier.toFixed(2)}x capture modifier
                </p>
              </div>
              <span
                className={`text-lg font-bold ${
                  quantity > 0 ? "text-amber-300" : "text-slate-600"
                }`}
              >
                × {quantity}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
