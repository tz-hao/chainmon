"use client";

import { getRiftConfig } from "@/lib/rift/config";
import { getNodeStatus } from "@/lib/rift/run-state";
import type { RiftMap, RiftNode, RiftNodeStatus } from "@/lib/rift/types";

interface RiftMapBoardProps {
  map: RiftMap;
  completedNodeIds: string[];
  onEnter: (nodeId: string) => void;
}

const TYPE_LABELS: Record<RiftNode["type"], string> = {
  "protocol-event": "Signal",
  battle: "Battle",
  capture: "Capture",
  rest: "Rest",
  elite: "Elite",
  boss: "Boss",
};

const STATUS_STYLE: Record<RiftNodeStatus, string> = {
  locked: "border-slate-800 text-slate-600",
  available: "border-amber-300 bg-amber-300/10 text-amber-100 hover:bg-amber-300 hover:text-slate-950",
  completed: "border-emerald-400/70 bg-emerald-400/10 text-emerald-100",
};

export function RiftMapBoard({ map, completedNodeIds, onEnter }: RiftMapBoardProps) {
  const rift = getRiftConfig(map.id);
  return (
    <section className="border-2 border-slate-700 bg-[#07101f]" data-rift={map.id} aria-labelledby="rift-map-title">
      <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">Active expedition // route board</p>
          <h1 id="rift-map-title" className="mt-1 font-mono text-2xl font-black uppercase tracking-[0.04em] text-slate-100">{rift.name}</h1>
          <p className="mt-1 text-xs text-slate-500">Choose an amber route node. Locked nodes open as the expedition stabilizes.</p>
        </div>
        <p className="border border-slate-700 bg-[#050b17] px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-slate-300"><span className="text-emerald-300">{completedNodeIds.length}</span> / {map.nodes.length} clear</p>
      </div>

      <ol className="divide-y divide-slate-800" aria-label={`${rift.name} route`}>
        {map.nodes.map((node) => {
          const status = getNodeStatus(node, completedNodeIds);
          return (
            <li key={node.id} className="bg-[#050b17]">
              <button
                type="button"
                disabled={status !== "available"}
                onClick={() => onEnter(node.id)}
                aria-label={`${node.title}: ${status}`}
                data-status={status}
                data-type={node.type}
                className={`grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-l-4 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-300 disabled:cursor-not-allowed ${STATUS_STYLE[status]}`}
              >
                <span className="font-mono text-sm font-black">{String(node.index + 1).padStart(2, "0")}</span>
                <span className="min-w-0">
                  <span className="block truncate font-mono text-sm font-black uppercase tracking-[0.03em]">{node.title}</span>
                  <span className="mt-1 block truncate text-[11px] text-slate-500">{node.subtitle}</span>
                </span>
                <span className="text-right font-mono text-[9px] font-black uppercase tracking-[0.1em]">
                  <span className="block opacity-80">{TYPE_LABELS[node.type]}</span>
                  <span className="mt-1 block opacity-55">{status}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
