"use client";

import type { RiftMap, RiftNode } from "@/lib/rift/types";
import { getRiftConfig } from "@/lib/rift/config";
import { getNodeStatus } from "@/lib/rift/run-state";
import { RiftIcon } from "./RiftIcon";

interface RiftMapBoardProps {
  map: RiftMap;
  completedNodeIds: string[];
  onEnter: (nodeId: string) => void;
}

function nodeTone(node: RiftNode): string {
  if (node.type === "boss") return "text-rose-200";
  if (node.type === "elite") return "text-amber-200";
  if (node.type === "capture") return "text-cyan-200";
  if (node.type === "protocol-event") return "text-violet-200";
  if (node.type === "rest") return "text-emerald-200";
  return "text-slate-100";
}

export function RiftMapBoard({ map, completedNodeIds, onEnter }: RiftMapBoardProps) {
  const byId = new Map(map.nodes.map((node) => [node.id, node]));
  const statuses = new Map(map.nodes.map((node) => [node.id, getNodeStatus(node, completedNodeIds)]));
  const rift = getRiftConfig(map.id);

  return (
    <section className="rift-panel" data-rift={map.id} aria-labelledby="rift-map-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="rift-kicker"><RiftIcon type="rift" className="h-4 w-4" /> Active expedition</div>
          <h1 id="rift-map-title" className="rift-title mt-3">{rift.name} route</h1>
          <p className="rift-copy mt-2">{rift.concepts.join(" · ")} · stabilize both opening branches to unlock the central route.</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3 font-mono text-sm text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <span className="text-emerald-300">{completedNodeIds.length}</span> / {map.nodes.length} nodes stabilized
        </div>
      </div>

      <div className="rift-map-stage relative mt-8 hidden h-[450px] overflow-hidden rounded-[1.5rem] border border-slate-800/90 md:block">
        <div className="rift-map-grid absolute inset-0" />
        <div className="absolute left-5 top-5 rounded-full border border-cyan-300/15 bg-slate-950/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-100/70">Choose the glowing route</div>
        <div className="absolute bottom-5 right-5 flex items-center gap-3 rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
          <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> cleared</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.7)]" /> reachable</span>
        </div>
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {map.nodes.flatMap((node) =>
            node.nextIds.map((nextId) => {
              const next = byId.get(nextId);
              if (!next) return null;
              const complete = completedNodeIds.includes(node.id);
              const nextStatus = statuses.get(nextId);
              const routeStatus = complete && nextStatus === "available"
                ? "available"
                : complete
                  ? "complete"
                  : "locked";
              return (
                <line
                  key={`${node.id}-${nextId}`}
                  x1={node.x}
                  y1={node.y}
                  x2={next.x}
                  y2={next.y}
                  vectorEffect="non-scaling-stroke"
                  className={`rift-route-line rift-route-line--${routeStatus}`}
                  strokeWidth="1.5"
                />
              );
            }),
          )}
        </svg>
        {map.nodes.map((node) => {
          const status = getNodeStatus(node, completedNodeIds);
          return (
            <button
              key={node.id}
              type="button"
              disabled={status !== "available"}
              onClick={() => onEnter(node.id)}
              aria-label={`${node.title}: ${status}`}
              data-status={status}
              data-type={node.type}
              style={{
                left: `clamp(4.75rem, ${node.x}%, calc(100% - 4.75rem))`,
                top: `${node.y}%`,
              }}
              className={`rift-map-node absolute w-36 -translate-x-1/2 -translate-y-1/2 border p-3 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                status === "completed"
                  ? "cursor-default"
                  : status === "available"
                    ? "cursor-pointer hover:-translate-y-[54%] hover:border-cyan-100"
                    : "cursor-not-allowed border border-slate-800 bg-slate-950/90 opacity-50"
              }`}
            >
              <div className={`flex items-center justify-between ${nodeTone(node)}`}>
                <RiftIcon type={node.type} className="h-5 w-5" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">0{node.index + 1}</span>
              </div>
              <p className="mt-2 text-xs font-semibold leading-tight text-slate-100">{node.title}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{status}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-3 md:hidden">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-100/65">Route sequence</p>
        {map.nodes.map((node) => {
          const status = getNodeStatus(node, completedNodeIds);
          return (
            <button
              key={node.id}
              type="button"
              disabled={status !== "available"}
              onClick={() => onEnter(node.id)}
              data-status={status}
              data-type={node.type}
              className={`rift-map-node flex min-h-20 items-center gap-4 border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                status === "completed"
                  ? "cursor-default"
                  : status === "available"
                    ? "cursor-pointer"
                    : "cursor-not-allowed border border-slate-800 bg-slate-950/50 opacity-55"
              }`}
            >
              <span className={nodeTone(node)}><RiftIcon type={node.type} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-100">{node.title}</span>
                <span className="text-xs text-slate-500">{node.subtitle}</span>
              </span>
              <span className="font-mono text-[10px] uppercase text-slate-500">{status}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
