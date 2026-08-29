"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TrainerProfile } from "@chainmon/shared";
import { getSpeciesById } from "@chainmon/monster-data";
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
import { RiftBattlePanel } from "./RiftBattlePanel";
import { RiftCapturePanel } from "./RiftCapturePanel";
import { RiftEventPanel } from "./RiftEventPanel";
import { RiftIcon } from "./RiftIcon";
import { RiftMapBoard } from "./RiftMapBoard";
import { RiftRestPanel } from "./RiftRestPanel";
import { RiftSummary } from "./RiftSummary";
import { RiftTeamSelect } from "./RiftTeamSelect";

type RiftView = "hub" | "team" | "select" | "run";

interface RiftExperienceProps {
  trainer: TrainerProfile;
  monsters: RiftMonsterView[];
  inventory: InventoryEntry[];
  portraits: Record<number, string>;
  initialTeamIds: string[];
}

function ProtocolMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-lg font-bold text-slate-100">+{value}</p>
    </div>
  );
}

function modifierTotal(run: RiftRunState, axis: ActiveRiftModifier["axis"]): number {
  return run.modifiers
    .filter((modifier) => modifier.axis === axis)
    .reduce((total, modifier) => total + modifier.amount, 0);
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
  const featured = rift.featuredSpeciesIds
    .map((speciesId) => getSpeciesById(speciesId)?.name)
    .filter((name): name is string => Boolean(name));
  return (
    <article
      className="rift-selection-card flex min-h-72 flex-col rounded-2xl border p-5 sm:p-6"
      data-rift={rift.id}
      data-selected={selected || undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">{rift.ordinal}</p>
          <h2 className="mt-2 text-2xl font-bold text-white">{rift.name}</h2>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-100/70">{rift.eyebrow}</p>
        </div>
        <span className="rift-selection-emblem grid h-10 w-10 place-items-center rounded-xl"><RiftIcon type="rift" className="h-5 w-5" /></span>
      </div>
      <p className="mt-5 text-sm leading-6 text-slate-400">{rift.description}</p>
      <div className="mt-5 flex flex-wrap gap-1.5">
        {rift.concepts.map((concept) => <span key={concept} className="rift-concept-tag">{concept}</span>)}
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-800/80 pt-4 sm:grid-cols-4">
        {[["Difficulty", rift.difficulty], ["Recommended", rift.recommendedLevel], ["Route", rift.runDuration], ["Boss", rift.bossTitle]].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[9px] uppercase tracking-[0.15em] text-slate-600">{label}</dt>
            <dd className={`mt-1 font-mono text-[10px] font-semibold text-slate-300 ${label === "Boss" ? "leading-4" : "truncate"}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[10px] uppercase tracking-[0.14em] text-slate-500">Featured · <span className="normal-case tracking-normal text-slate-300">{featured.join(" · ")}</span></p>
      <button type="button" onClick={onChoose} className="rift-button-secondary mt-6 w-full">
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
  const activeRift = activeRun ? getRiftConfig(activeRun.riftId) : null;
  return (
    <div className="space-y-6 animate-fade-in-up">
      <section className="rift-panel rift-stage px-6 py-10 sm:px-10 sm:py-14">
        <div className="rift-hero-orbit hidden sm:block" aria-hidden="true" />
        <div className="max-w-3xl">
          <div className="rift-kicker"><RiftIcon type="rift" className="h-4 w-4" /> Protocol expedition layer</div>
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.24em] text-cyan-100/60">Four connected protocol environments</p>
          <h1 className="mt-3 text-5xl font-black tracking-[-0.05em] text-white sm:text-6xl lg:text-7xl">
            Enter the <span className="bg-gradient-to-r from-emerald-100 via-cyan-200 to-violet-200 bg-clip-text text-transparent">Protocol Rift</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            Form a field squad, read each protocol environment and bring permanent collection progress back from a temporary route.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {activeRun ? (
              <button type="button" onClick={() => onEnter(activeRun.riftId)} className="rift-button-primary">Resume {activeRift?.name}</button>
            ) : (
              <button type="button" onClick={() => onEnter("liquidity-grove")} className="rift-button-primary">Assemble a team</button>
            )}
            <Link href="/monsters" className="rift-button-secondary text-center">Inspect collection</Link>
          </div>
          <p className="mt-5 max-w-xl text-xs leading-5 text-slate-500">Rift play never requests a wallet signature, transaction, token approval or NFT mint.</p>
        </div>
      </section>

      <section aria-labelledby="rift-directory-title">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="rift-kicker text-slate-400">Rift directory</p>
            <h2 id="rift-directory-title" className="mt-2 text-2xl font-bold text-white">Four routes, one tactical loop</h2>
          </div>
          <p className="hidden text-xs text-slate-500 sm:block">Each route has eight nodes and its own protocol decisions.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
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

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rift-dossier p-5 sm:p-6">
          <p className="rift-kicker text-slate-400">Rift promise</p>
          <h2 className="mt-3 text-2xl font-bold text-white">A compact tactical loop, not a dashboard.</h2>
          <div className="mt-6 grid gap-5 border-t border-slate-800/80 pt-5 sm:grid-cols-3">
            {[["01", "Choose a route", "Each environment has a clear protocol identity."], ["02", "Read the pressure", "Events grant temporary signal, guard or tempo."], ["03", "Stabilize the core", "Battles and captures update your collection safely."]].map(([index, title, copy]) => (
              <div key={index}>
                <p className="font-mono text-xs text-cyan-200">{index}</p>
                <h3 className="mt-2 text-sm font-semibold text-slate-100">{title}</h3>
                <p className="mt-2 text-sm leading-5 text-slate-500">{copy}</p>
              </div>
            ))}
          </div>
        </div>
        <aside className="rift-dossier p-5 sm:p-6">
          <p className="rift-kicker text-slate-400">Field dossier</p>
          <div className="mt-5 flex items-end justify-between gap-4 border-b border-slate-800/80 pb-4">
            <div><p className="text-lg font-bold text-white">{trainer.nickname}</p><p className="mt-1 text-xs text-slate-500">Trainer profile</p></div>
            <RiftIcon type="team" className="h-7 w-7 text-cyan-200/75" />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
            {[["Collection", monsters.length], ["Captures", trainer.captures], ["Victories", trainer.wins], ["Gold", trainer.gold]].map(([label, value]) => (
              <div key={label}><dt className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</dt><dd className="rift-dossier-value mt-1 font-mono text-xl font-bold text-slate-100">{value}</dd></div>
            ))}
          </dl>
        </aside>
      </section>
    </div>
  );
}

export function RiftExperience({ trainer, monsters, inventory, portraits, initialTeamIds }: RiftExperienceProps) {
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
  if (view === "team") return <RiftTeamSelect monsters={availableMonsters} portraits={portraits} selectedIds={selectedIds} onChange={setSelectedIds} onBack={() => setView("hub")} onContinue={() => setView("select")} />;
  if (view === "select") {
    return (
      <section className="rift-panel animate-fade-in-up" aria-labelledby="rift-select-title">
        <div className="rift-kicker"><RiftIcon type="rift" className="h-4 w-4" /> Protocol anomaly scan</div>
        <h1 id="rift-select-title" className="rift-title mt-3">Select a Rift</h1>
        <p className="rift-copy mt-2">Choose one environment. Difficulty, node levels, signals and boss pressure are set by that route’s configuration.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {RIFT_CATALOGUE.map((rift) => <RiftCard key={rift.id} riftId={rift.id} selected={rift.id === selectedRiftId} actionLabel={rift.id === selectedRiftId ? "Begin this expedition" : "Select this Rift"} onChoose={() => rift.id === selectedRiftId ? startRun(rift.id) : setSelectedRiftId(rift.id)} />)}
        </div>
        <button type="button" onClick={() => setView("team")} className="rift-button-secondary mt-8">Back to team</button>
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
      <div className="grid gap-3 sm:grid-cols-3"><ProtocolMetric label="Signal" value={modifierTotal(run, "signal")} /><ProtocolMetric label="Guard" value={modifierTotal(run, "guard")} /><ProtocolMetric label="Tempo" value={modifierTotal(run, "tempo")} /></div>
      <RiftMapBoard map={map} completedNodeIds={run.completedNodeIds} onEnter={(nodeId) => setRun((current) => current ? enterRiftNode(current, nodeId) : current)} />
      <p className="rounded-2xl border border-slate-800 bg-slate-950/40 px-5 py-4 text-xs leading-5 text-slate-500">Route state is temporary in this tab. Battle rewards and captures persist safely to your collection.</p>
    </div>
  );
}
