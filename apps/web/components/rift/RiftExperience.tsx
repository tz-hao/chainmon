"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TrainerProfile } from "@chainmon/shared";
import type { BattleRewardSettlement, InventoryEntry } from "@/lib/data";
import { RIFT_CATALOGUE, getRiftConfig, getRiftEvent } from "@/lib/rift/config";
import { generateRiftRoute } from "@/lib/rift/generator";
import {
  RIFT_SESSION_STORAGE_KEY,
  applyEventChoice,
  completeRiftNode,
  createRiftRun,
  enterRiftNode,
  restoreRiftRun,
  serializeRiftRun,
} from "@/lib/rift/run-state";
import type {
  ActiveRiftModifier,
  RiftCaptureSummary,
  RiftId,
  RiftMonsterView,
  RiftRunState,
} from "@/lib/rift/types";
import { PixelMonster } from "../PixelMonster";
import { RiftBattlePanel } from "./RiftBattlePanel";
import { RiftCapturePanel } from "./RiftCapturePanel";
import { RiftEventPanel } from "./RiftEventPanel";
import { RiftMapBoard } from "./RiftMapBoard";
import { RiftRestPanel } from "./RiftRestPanel";
import { RiftSummary } from "./RiftSummary";
import { RiftTeamSelect } from "./RiftTeamSelect";

type RiftView = "hub" | "team" | "select" | "run";

interface RiftExperienceProps {
  trainer: TrainerProfile;
  monsters: RiftMonsterView[];
  inventory: InventoryEntry[];
  initialTeamIds: string[];
}

const RIFT_THEME: Record<RiftId, { border: string; accent: string; label: string; button: string }> = {
  "liquidity-grove": {
    border: "border-emerald-400/55",
    accent: "text-emerald-200",
    label: "text-emerald-300",
    button: "border-emerald-300/70 text-emerald-100 hover:bg-emerald-300 hover:text-slate-950",
  },
  "proof-network": {
    border: "border-sky-400/55",
    accent: "text-sky-200",
    label: "text-sky-300",
    button: "border-sky-300/70 text-sky-100 hover:bg-sky-300 hover:text-slate-950",
  },
  "gas-wasteland": {
    border: "border-amber-400/55",
    accent: "text-amber-200",
    label: "text-amber-300",
    button: "border-amber-300/70 text-amber-100 hover:bg-amber-300 hover:text-slate-950",
  },
  "credit-abyss": {
    border: "border-violet-400/55",
    accent: "text-violet-200",
    label: "text-violet-300",
    button: "border-violet-300/70 text-violet-100 hover:bg-violet-300 hover:text-slate-950",
  },
};

const ROUTE_TYPES = ["Signal", "Battle", "Capture", "Signal", "Rest", "Battle", "Elite", "Boss"] as const;

function ProtocolMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-slate-700 bg-[#07101f] px-4 py-3">
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-lg font-black text-amber-200">+{value}</p>
    </div>
  );
}

function modifierTotal(run: RiftRunState, axis: ActiveRiftModifier["axis"]): number {
  return run.modifiers
    .filter((modifier) => modifier.axis === axis)
    .reduce((total, modifier) => total + modifier.amount, 0);
}

function routeSlots(riftId: RiftId) {
  const route = getRiftConfig(riftId).route;
  return [
    route.openingEvent,
    route.openingBattle,
    route.capture,
    route.convergenceEvent,
    route.rest,
    route.standardBattle,
    route.elite,
    route.boss,
  ];
}

function RoutePreview({ riftId }: { riftId: RiftId }) {
  const rift = getRiftConfig(riftId);
  const theme = RIFT_THEME[riftId];
  return (
    <section className={`border ${theme.border} bg-[#07101f]`} aria-labelledby="rift-route-preview-title">
      <div className="flex flex-col gap-2 border-b border-slate-800 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={`font-mono text-[9px] font-black uppercase tracking-[0.18em] ${theme.label}`}>Route signal</p>
          <h2 id="rift-route-preview-title" className="mt-1 font-mono text-base font-black uppercase tracking-[0.06em] text-slate-100">{rift.name} · eight-step route</h2>
        </div>
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">One split → one convergence → final boss</p>
      </div>
      <ol className="grid grid-cols-4 divide-x divide-y divide-slate-800 sm:grid-cols-8 sm:divide-y-0" aria-label={`${rift.name} route preview`}>
        {routeSlots(riftId).map((slot, index) => (
          <li key={slot.id} className="min-w-0 bg-[#050b17] px-2 py-3">
            <p className={`font-mono text-[9px] font-black ${theme.accent}`}>{String(index + 1).padStart(2, "0")}</p>
            <p className="mt-1 truncate font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-slate-200">{ROUTE_TYPES[index]}</p>
            <p className="mt-1 truncate text-[10px] text-slate-500">{slot.title}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function RiftCard({
  riftId,
  selected,
  actionLabel,
  onChoose,
}: {
  riftId: RiftId;
  selected?: boolean;
  actionLabel: string;
  onChoose: () => void;
}) {
  const rift = getRiftConfig(riftId);
  const theme = RIFT_THEME[riftId];
  return (
    <article
      className={`flex min-h-[18rem] flex-col border bg-[#07101f] p-4 transition-colors ${theme.border} ${selected ? "bg-slate-900" : "hover:bg-slate-900/75"}`}
      data-rift={rift.id}
      data-selected={selected || undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`font-mono text-[9px] font-black uppercase tracking-[0.18em] ${theme.label}`}>{rift.ordinal} · BIOME</p>
          <h2 className="mt-2 font-mono text-xl font-black uppercase tracking-[0.03em] text-slate-100">{rift.name}</h2>
          <p className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">{rift.eyebrow}</p>
        </div>
        <span className="shrink-0 border border-slate-700 bg-[#050b17] px-2 py-1 font-mono text-[9px] font-black text-slate-300">8 NODES</span>
      </div>

      <div className="mt-4 flex min-h-16 items-center border-y border-slate-800 bg-[#050b17] px-2" aria-label={`${rift.name} featured creatures`}>
        {rift.featuredSpeciesIds.map((speciesId) => (
          <PixelMonster
            key={speciesId}
            speciesId={speciesId}
            variant="battle-front"
            alt={`${rift.name} featured creature`}
            className="h-16 w-16"
          />
        ))}
        <p className="ml-auto max-w-[7.5rem] text-right font-mono text-[9px] uppercase tracking-[0.08em] text-slate-500">featured creatures</p>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-400">{rift.description}</p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-800 pt-3 font-mono text-[9px] uppercase tracking-[0.1em]">
        <span className="text-slate-500">{rift.difficulty}</span>
        <span className={theme.accent}>{rift.recommendedLevel}</span>
        <span className="truncate text-slate-500">{rift.bossTitle}</span>
      </div>
      <button
        type="button"
        onClick={onChoose}
        className={`mt-auto border bg-[#050b17] px-3 py-3 font-mono text-[10px] font-black uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${theme.button}`}
      >
        {actionLabel}
      </button>
    </article>
  );
}

function Hub({
  trainer,
  monsters,
  activeRun,
  onEnter,
}: {
  trainer: TrainerProfile;
  monsters: RiftMonsterView[];
  activeRun: RiftRunState | null;
  onEnter: (riftId: RiftId) => void;
}) {
  const previewRiftId = activeRun?.riftId ?? "liquidity-grove";
  return (
    <div className="space-y-5 animate-fade-in-up">
      <section className="border-2 border-slate-700 bg-[#07101f]" aria-labelledby="rift-hub-title">
        <div className="flex flex-col gap-4 border-b border-slate-800 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
          <div>
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">Protocol Rift // anomaly map</p>
            <h1 id="rift-hub-title" className="mt-1 font-mono text-2xl font-black uppercase tracking-[0.04em] text-slate-100 sm:text-3xl">Choose a biome. Run the route.</h1>
          </div>
          <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-slate-500">{trainer.nickname} · {monsters.length} creatures ready</p>
        </div>
        <p className="px-4 py-3 text-xs leading-5 text-slate-400 sm:px-5">Each biome is a compact eight-step expedition. Build a field team, stabilize the active route, then return rewards to the collection.</p>
      </section>

      <section aria-labelledby="rift-directory-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Rift directory</p>
            <h2 id="rift-directory-title" className="mt-1 font-mono text-lg font-black uppercase text-slate-100">Four playable biomes</h2>
          </div>
          <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-slate-500">Choose one route</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {RIFT_CATALOGUE.map((rift) => (
            <RiftCard
              key={rift.id}
              riftId={rift.id}
              actionLabel={activeRun?.riftId === rift.id ? "Resume route" : "Choose route"}
              selected={activeRun?.riftId === rift.id}
              onChoose={() => onEnter(rift.id)}
            />
          ))}
        </div>
      </section>

      <RoutePreview riftId={previewRiftId} />
    </div>
  );
}

export function RiftExperience({ trainer, monsters, inventory, initialTeamIds }: RiftExperienceProps) {
  const router = useRouter();
  const [availableMonsters, setAvailableMonsters] = useState(monsters);
  const [view, setView] = useState<RiftView>("hub");
  const [selectedRiftId, setSelectedRiftId] = useState<RiftId>("liquidity-grove");
  const [selectedIds, setSelectedIds] = useState<string[]>(() => initialTeamIds.length ? initialTeamIds.slice(0, 3) : monsters.slice(0, 3).map((monster) => monster.id));
  const [run, setRun] = useState<RiftRunState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setAvailableMonsters(monsters), [monsters]);
  useEffect(() => {
    const restored = restoreRiftRun(window.sessionStorage.getItem(RIFT_SESSION_STORAGE_KEY));
    if (restored) {
      setRun(restored);
      setSelectedRiftId(restored.riftId);
      setSelectedIds(restored.selectedMonsterIds);
    } else {
      window.sessionStorage.removeItem(RIFT_SESSION_STORAGE_KEY);
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    if (run) window.sessionStorage.setItem(RIFT_SESSION_STORAGE_KEY, serializeRiftRun(run));
    else window.sessionStorage.removeItem(RIFT_SESSION_STORAGE_KEY);
  }, [hydrated, run]);

  const map = useMemo(() => run ? generateRiftRoute(run.riftId, run.seed) : null, [run]);
  const activeNode = run?.activeNodeId ? map?.nodes.find((node) => node.id === run.activeNodeId) : undefined;
  const resumeOrAssemble = useCallback((riftId: RiftId) => {
    setSelectedRiftId(riftId);
    if (run?.riftId === riftId) setView("run");
    else setView("team");
  }, [run]);
  const startRun = useCallback((riftId: RiftId) => {
    const seed = globalThis.crypto?.randomUUID?.() ?? `rift-${Date.now().toString(36)}`;
    setRun(createRiftRun(riftId, seed, selectedIds));
    setView("run");
  }, [selectedIds]);
  const closeRun = useCallback(() => { setRun(null); setView("hub"); }, []);
  const onBattleReady = useCallback((battleId: string) => setRun((current) => current && current.activeBattleId !== battleId ? { ...current, activeBattleId: battleId } : current), []);
  const onEncounterReady = useCallback((encounterId: string) => setRun((current) => current && current.activeEncounterId !== encounterId ? { ...current, activeEncounterId: encounterId } : current), []);
  const completeBattle = useCallback((settlement: BattleRewardSettlement | null) => {
    setRun((current) => {
      if (!current?.activeNodeId) return current;
      const exp = settlement?.monsters.reduce((total, monster) => total + monster.expGained, 0) ?? 0;
      const items = { ...current.rewards.items };
      for (const item of settlement?.items ?? []) items[item.itemSlug] = (items[item.itemSlug] ?? 0) + item.quantity;
      return completeRiftNode({ ...current, rewards: { ...current.rewards, battlesWon: current.rewards.battlesWon + 1, gold: current.rewards.gold + (settlement?.gold ?? 0), exp: current.rewards.exp + exp, items } }, current.activeNodeId);
    });
    if (settlement) router.refresh();
  }, [router]);
  const completeCapture = useCallback((capture: RiftCaptureSummary) => {
    setRun((current) => current?.activeNodeId ? completeRiftNode({ ...current, rewards: { ...current.rewards, capture } }, current.activeNodeId) : current);
    router.refresh();
  }, [router]);

  if (view === "hub") return <Hub trainer={trainer} monsters={availableMonsters} activeRun={run} onEnter={resumeOrAssemble} />;
  if (view === "team") return <RiftTeamSelect monsters={availableMonsters} selectedIds={selectedIds} onChange={setSelectedIds} onBack={() => setView("hub")} onContinue={() => setView("select")} />;
  if (view === "select") {
    return (
      <section className="border-2 border-slate-700 bg-[#07101f] animate-fade-in-up" aria-labelledby="rift-select-title">
        <div className="border-b border-slate-800 px-4 py-4 sm:px-5">
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">Protocol Rift // scan complete</p>
          <h1 id="rift-select-title" className="mt-1 font-mono text-2xl font-black uppercase tracking-[0.04em] text-slate-100">Confirm your route</h1>
          <p className="mt-2 text-xs leading-5 text-slate-400">Select a biome once, then begin the generated eight-step expedition.</p>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2 sm:p-5">
          {RIFT_CATALOGUE.map((rift) => <RiftCard key={rift.id} riftId={rift.id} selected={rift.id === selectedRiftId} actionLabel={rift.id === selectedRiftId ? "Begin expedition" : "Select biome"} onChoose={() => rift.id === selectedRiftId ? startRun(rift.id) : setSelectedRiftId(rift.id)} />)}
        </div>
        <div className="border-t border-slate-800 p-4 sm:p-5"><button type="button" onClick={() => setView("team")} className="border border-slate-600 bg-[#050b17] px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.12em] text-slate-300 transition-colors hover:border-amber-300 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">Back to team</button></div>
      </section>
    );
  }
  if (!run || !map) return <Hub trainer={trainer} monsters={availableMonsters} activeRun={null} onEnter={resumeOrAssemble} />;
  if (run.status === "completed") return <RiftSummary run={run} onNewRun={closeRun} />;
  if (activeNode) {
    if (activeNode.type === "protocol-event" && activeNode.eventId) {
      const event = getRiftEvent(activeNode.eventId);
      if (event) return <RiftEventPanel event={event} onChoose={(choice) => setRun((current) => current ? applyEventChoice(current, choice) : current)} />;
    }
    if (["battle", "elite", "boss"].includes(activeNode.type)) return <RiftBattlePanel riftId={run.riftId} seed={run.seed} node={activeNode} monsterIds={run.selectedMonsterIds} onBattleReady={onBattleReady} onVictory={completeBattle} onAbandon={closeRun} />;
    if (activeNode.type === "capture") return <RiftCapturePanel riftId={run.riftId} seed={run.seed} node={activeNode} initialInventory={inventory} onEncounterReady={onEncounterReady} onCaptured={completeCapture} />;
    if (activeNode.type === "rest") return <RiftRestPanel onComplete={(modifier) => setRun((current) => current?.activeNodeId ? completeRiftNode({ ...current, modifiers: [...current.modifiers, { ...modifier, sourceNodeId: current.activeNodeId }] }, current.activeNodeId) : current)} />;
  }
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="grid gap-2 sm:grid-cols-3"><ProtocolMetric label="Signal" value={modifierTotal(run, "signal")} /><ProtocolMetric label="Guard" value={modifierTotal(run, "guard")} /><ProtocolMetric label="Tempo" value={modifierTotal(run, "tempo")} /></div>
      <RiftMapBoard map={map} completedNodeIds={run.completedNodeIds} onEnter={(nodeId) => setRun((current) => current ? enterRiftNode(current, nodeId) : current)} />
      <p className="border border-slate-800 bg-[#07101f] px-4 py-3 text-xs leading-5 text-slate-500">Route state is temporary in this tab. Battle rewards and captures persist safely to your collection.</p>
    </div>
  );
}
