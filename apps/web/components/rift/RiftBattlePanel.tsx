"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type {
  BattleAction,
  BattleLogEntry,
  BattleState,
} from "@chainmon/game-engine";
import type { BattleRewardSettlement } from "@/lib/data";
import type { RiftId, RiftNode } from "@/lib/rift/types";
import { getMonsterVisualPath } from "@/lib/world/monster-visuals";
import { RiftIcon } from "./RiftIcon";

interface BattlePayload {
  state: BattleState;
  logs: BattleLogEntry[];
  rewards: BattleRewardSettlement | null;
}

interface RiftBattlePanelProps {
  riftId: RiftId;
  seed: string;
  node: RiftNode;
  monsterIds: string[];
  onBattleReady: (battleId: string) => void;
  onVictory: (rewards: BattleRewardSettlement | null) => void;
  onAbandon: () => void;
}

async function readPayload(response: Response): Promise<BattlePayload> {
  const body = (await response.json()) as BattlePayload & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Battle request failed.");
  return body;
}

function HealthMeter({ current, max }: { current: number; max: number }) {
  const ratio = Math.max(0, Math.min(100, Math.round((current / Math.max(max, 1)) * 100)));
  const tone = ratio > 55 ? "bg-emerald-400" : ratio > 25 ? "bg-amber-400" : "bg-rose-400";
  return (
    <div className="h-2.5 overflow-hidden rounded-full border border-white/5 bg-slate-950/80" aria-label={`${current} of ${max} health`}>
      <div className={`h-full rounded-full shadow-[0_0_10px_currentColor] transition-[width] duration-500 ${tone}`} style={{ width: `${ratio}%` }} />
    </div>
  );
}

export function RiftBattlePanel({
  riftId,
  seed,
  node,
  monsterIds,
  onBattleReady,
  onVictory,
  onAbandon,
}: RiftBattlePanelProps) {
  const [payload, setPayload] = useState<BattlePayload | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCommand, setSelectedCommand] = useState<string | null>(null);
  const [lastDamage, setLastDamage] = useState<{
    target: "player" | "opponent";
    amount: number;
    elementMultiplier?: number;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setPending(true);
    setError(null);
    void fetch("/api/rift/battle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ riftId, seed, nodeId: node.id, monsterIds }),
      signal: controller.signal,
    })
      .then(readPayload)
      .then((record) => {
        setPayload(record);
        onBattleReady(record.state.id);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Battle could not start.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(false);
      });
    return () => controller.abort();
  }, [monsterIds, node.id, onBattleReady, riftId, seed]);

  const state = payload?.state;
  const player = state?.playerTeam[state.playerActiveIndex];
  const opponent = state?.opponentTeam[state.opponentActiveIndex];
  const battleComplete = state?.status === "completed";
  const victory = battleComplete && state.winner === "player";

  const recentLogs = useMemo(() => payload?.logs.slice(-5).reverse() ?? [], [payload?.logs]);
  const playerWasHit = Boolean(lastDamage?.target === "player");
  const opponentWasHit = Boolean(lastDamage?.target === "opponent");

  function effectiveness(multiplier?: number): string {
    if (multiplier && multiplier > 1) return "Effective";
    if (multiplier && multiplier < 1) return "Resisted";
    return "Neutral";
  }

  async function submit(action: BattleAction, commandName: string) {
    if (!state || pending || battleComplete) return;
    setPending(true);
    setError(null);
    setSelectedCommand(commandName);
    setLastDamage(null);
    const logCount = payload?.logs.length ?? 0;
    try {
      const response = await fetch("/api/rift/battle/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ battleId: state.id, expectedTurn: state.turn, action }),
      });
      const nextPayload = await readPayload(response);
      const newDamage = nextPayload.logs.slice(logCount).filter((entry) => entry.type === "damage" && entry.damage).at(-1);
      if (newDamage?.damage) {
        setLastDamage({
          target: newDamage.target === state.playerTeam[state.playerActiveIndex]?.speciesName ? "player" : "opponent",
          amount: newDamage.damage,
          elementMultiplier: newDamage.elementMultiplier,
        });
      }
      setPayload(nextPayload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Action could not be resolved.");
    } finally {
      setPending(false);
    }
  }

  if (!state || !player || !opponent) {
    return (
      <section className="rift-panel min-h-[420px] animate-fade-in-up">
        <div className="rift-kicker"><RiftIcon type={node.type} className="h-4 w-4" /> {node.subtitle}</div>
        <div className="grid min-h-72 place-items-center text-center">
          <div>
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-300" />
            <p className="mt-4 text-sm text-slate-400">Opening the battle channel…</p>
            {error ? <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p> : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`rift-panel rift-battle-stage animate-fade-in-up ${node.type === "boss" ? "ring-1 ring-rose-400/25" : ""}`} data-rift={riftId} aria-labelledby="rift-battle-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className={`rift-kicker ${node.type === "boss" ? "text-rose-200" : node.type === "elite" ? "text-amber-200" : ""}`}>
            <RiftIcon type={node.type} className="h-4 w-4" /> {node.subtitle}
          </div>
          <h1 id="rift-battle-title" className="rift-title mt-3">{node.title}</h1>
          <p className="mt-2 text-sm text-slate-400">Resolve one command at a time. The opposing unit responds after your action.</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-slate-400">
          Turn <span className="text-cyan-200">{Math.max(1, state.turn)}</span> <span className="text-slate-600">·</span> {pending ? "enemy analyzing" : "ready"}
        </div>
      </div>

      <div key={state.turn} className="mt-8 grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <article className={`rift-combatant rift-combatant--player border p-5 ${playerWasHit ? "rift-combatant--impact" : ""}`} data-impact={playerWasHit || undefined}>
          <div className="flex items-center gap-4">
            <div className="rift-portrait-vault h-28 w-28 shrink-0">
              <Image src={getMonsterVisualPath(player.speciesId, "portrait")} alt={`${player.speciesName} battle portrait`} fill sizes="112px" className="object-contain p-2 [image-rendering:pixelated]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200">Your active unit · Lv {player.level}</p>
              <h2 className="mt-1 truncate text-2xl font-bold text-white">{player.speciesName}</h2>
              <div className="mt-4 flex items-center justify-between font-mono text-xs text-slate-400"><span>Integrity</span><span>{player.currentHp} / {player.maxHp}</span></div>
              <div className="mt-2"><HealthMeter current={player.currentHp} max={player.maxHp} /></div>
              {playerWasHit && lastDamage ? <div className="rift-damage-pop" aria-live="polite">−{lastDamage.amount}<span>{effectiveness(lastDamage.elementMultiplier)} · Critical: none</span></div> : null}
            </div>
          </div>
        </article>
        <div className="mx-auto text-center"><div className="rift-versus-core" aria-label="versus"><span>VS</span></div>{pending ? <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.15em] text-amber-200">Enemy action</p> : null}</div>
        <article className={`rift-combatant rift-combatant--enemy border p-5 ${node.type === "boss" ? "rift-combatant--boss" : ""} ${opponentWasHit ? "rift-combatant--impact" : ""}`} data-impact={opponentWasHit || undefined}>
          <div className="flex items-center gap-4 lg:flex-row-reverse lg:text-right">
            <div className="rift-portrait-vault h-28 w-28 shrink-0">
              <Image src={getMonsterVisualPath(opponent.speciesId, "portrait")} alt={`${opponent.speciesName} battle portrait`} fill sizes="112px" className="object-contain p-2 [image-rendering:pixelated]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-[10px] uppercase tracking-[0.18em] ${node.type === "boss" ? "text-rose-200" : "text-violet-200"}`}>Hostile signal · Lv {opponent.level}</p>
              <h2 className="mt-1 truncate text-2xl font-bold text-white">{opponent.speciesName}</h2>
              <div className="mt-4 flex items-center justify-between font-mono text-xs text-slate-400 lg:flex-row-reverse"><span>Integrity</span><span>{opponent.currentHp} / {opponent.maxHp}</span></div>
              <div className="mt-2"><HealthMeter current={opponent.currentHp} max={opponent.maxHp} /></div>
              {opponentWasHit && lastDamage ? <div className="rift-damage-pop rift-damage-pop--enemy" aria-live="polite">−{lastDamage.amount}<span>{effectiveness(lastDamage.elementMultiplier)} · Critical: none</span></div> : null}
            </div>
          </div>
        </article>
      </div>

      {battleComplete ? (
        <div className={`mt-6 rounded-2xl border p-6 text-center ${victory ? "border-emerald-300/30 bg-emerald-300/10" : "border-rose-400/30 bg-rose-400/10"}`}>
          <p className={`font-mono text-xs uppercase tracking-[0.25em] ${victory ? "text-emerald-300" : "text-rose-300"}`}>{victory ? "Node stabilized" : "Deployment failed"}</p>
          <h2 className="mt-2 text-2xl font-bold text-white">{victory ? "Protocol threat neutralized" : "The Rift rejected this team"}</h2>
          {victory ? (
            <button type="button" onClick={() => onVictory(payload.rewards)} className="rift-button-primary mt-5">Commit node and continue</button>
          ) : (
            <button type="button" onClick={onAbandon} className="rift-button-secondary mt-5">Close run and regroup</button>
          )}
        </div>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-800/90 bg-slate-950/45 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Tactical command board</p>
                <p className="mt-1 text-xs text-slate-500">Choose an action; enemy response follows immediately.</p>
              </div>
              <RiftIcon type="battle" className="h-5 w-5 text-cyan-200" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button type="button" disabled={pending} onClick={() => void submit({ type: "basic_attack" }, "Basic attack")} data-selected={selectedCommand === "Basic attack" || undefined} className="rift-command-button border-cyan-300/25 bg-cyan-300/5">
                <RiftIcon type="battle" className="h-5 w-5 text-cyan-200" />
                <span><span className="block">Basic attack</span><span className="mt-1 block font-mono text-[10px] font-normal text-slate-500">Reliable physical strike</span></span>
              </button>
              <button type="button" disabled={pending} onClick={() => void submit({ type: "defend" }, "Defend")} data-selected={selectedCommand === "Defend" || undefined} className="rift-command-button border-emerald-300/20 bg-emerald-300/[0.035]">
                <RiftIcon type="signal" className="h-5 w-5 text-emerald-200" />
                <span><span className="block">Defend</span><span className="mt-1 block font-mono text-[10px] font-normal text-slate-500">Brace for the next exchange</span></span>
              </button>
              {player.skills.map((skill, index) => (
                <button key={skill.id} type="button" disabled={pending} onClick={() => void submit({ type: "skill", skillId: skill.id }, skill.name)} data-selected={selectedCommand === skill.name || undefined} className={`rift-command-button ${index === 0 ? "border-violet-300/35 bg-violet-300/[0.045]" : ""}`}>
                  <RiftIcon type={index === 0 ? "signal" : "battle"} className={index === 0 ? "h-5 w-5 text-violet-200" : "h-5 w-5 text-amber-200"} />
                  <span className="min-w-0"><span className="block truncate">{skill.name}</span><span className="mt-1 block font-mono text-[10px] font-normal text-slate-500">PWR {skill.power} · ACC {skill.accuracy}</span></span>
                </button>
              ))}
            </div>
            <div className="mt-5 border-t border-slate-800/80 pt-5">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Your squad line</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-600">Active + reserves</p>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {state.playerTeam.map((member) => (
                  <div key={member.battleMonsterId} className="rift-bench-unit flex items-center justify-between gap-3 px-3 py-2" data-active={member.battleMonsterId === player.battleMonsterId}>
                    <span className="min-w-0 truncate text-xs font-semibold text-slate-200">{member.speciesName}</span>
                    <span className="font-mono text-[10px] text-slate-500">{member.fainted ? "FAINTED" : `${member.currentHp} HP`}</span>
                  </div>
                ))}
                {state.playerTeam.length === 1 ? <div className="rift-bench-unit px-3 py-2 text-xs text-slate-600">No reserve unit assigned</div> : null}
              </div>
            </div>
            {state.playerTeam.length > 1 ? (
              <div className="mt-5 border-t border-slate-800/80 pt-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Switch active unit</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {state.playerTeam.map((member) => (
                    <button
                      key={member.battleMonsterId}
                      type="button"
                      disabled={pending || member.fainted || member.battleMonsterId === player.battleMonsterId}
                      onClick={() => void submit({ type: "switch", targetBattleMonsterId: member.battleMonsterId }, `Switch ${member.speciesName}`)}
                      className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-300 transition hover:-translate-y-0.5 hover:border-cyan-300/50 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {member.speciesName} · {member.currentHp} HP
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {pending ? <p aria-live="polite" className="mt-4 text-sm text-cyan-200">Resolving both actions on the server…</p> : null}
            {error ? <p role="alert" className="mt-4 rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
          </div>
          <div className="rounded-2xl border border-slate-800/90 bg-slate-950/45 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Combat feed</p>
                <p className="mt-1 text-xs text-slate-500">The newest resolution stays at the top.</p>
              </div>
              <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-200"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.8)]" /> live</span>
            </div>
            <ol className="mt-4 space-y-3" aria-live="polite">
              {recentLogs.length ? recentLogs.map((entry, index) => (
                <li key={`${entry.turn}-${entry.type}-${index}`} className="rift-log-entry px-3 py-2 text-sm leading-5 text-slate-300" data-latest={index === 0}><span className="mr-2 font-mono text-[10px] text-slate-600">T{entry.turn}</span>{entry.message}</li>
              )) : <li className="rift-log-entry px-3 py-3 text-sm text-slate-500">Awaiting your first command. The hostile signal is reading your squad.</li>}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
