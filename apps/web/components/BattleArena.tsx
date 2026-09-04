"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { BattleAction, BattleCreatureState, BattleLogEntry, BattleState } from "@chainmon/game-engine";
import type { BattleRewardSettlement } from "@/lib/data";
import { submitAction } from "@/actions/battle-round";
import { PixelMonster } from "./PixelMonster";

interface BattleArenaProps {
  initialState: BattleState;
  initialLogs: BattleLogEntry[];
  initialRewards?: BattleRewardSettlement | null;
}

function VitalityBar({ current, max }: { current: number; max: number }) {
  const percentage = Math.max(0, Math.min(100, Math.round((current / Math.max(max, 1)) * 100)));
  const tone = percentage > 50 ? "bg-emerald-400" : percentage > 20 ? "bg-amber-300" : "bg-rose-400";
  return <div className="h-2 border border-slate-800 bg-[#050b17]"><div className={`h-full ${tone} transition-[width] duration-500`} style={{ width: `${percentage}%` }} /></div>;
}

function BattleHud({ creature, side }: { creature: BattleCreatureState; side: "player" | "opponent" }) {
  const player = side === "player";
  return (
    <div className={`border bg-[#07101f] px-3 py-2.5 ${creature.fainted ? "border-slate-800 opacity-45" : player ? "border-amber-300/70" : "border-violet-300/70"}`}>
      <div className={`flex items-center justify-between gap-2 ${player ? "" : "sm:flex-row-reverse"}`}>
        <p className={`truncate font-mono text-sm font-black uppercase tracking-[0.03em] text-slate-100 ${player ? "" : "sm:text-right"}`}>{creature.speciesName}</p>
        <span className={`shrink-0 font-mono text-[9px] font-black uppercase tracking-[0.1em] ${player ? "text-amber-200" : "text-violet-200"}`}>Lv {creature.level}</span>
      </div>
      <p className={`mt-1 font-mono text-[9px] uppercase tracking-[0.09em] text-slate-500 ${player ? "" : "sm:text-right"}`}>{creature.element} · {creature.rarity}{creature.fainted ? " · fainted" : ""}</p>
      <div className={`mt-3 flex items-center justify-between font-mono text-[9px] ${player ? "" : "sm:flex-row-reverse"}`}><span className="text-slate-500">VIT</span><span className="text-slate-300">{creature.currentHp} / {creature.maxHp}</span></div>
      <div className="mt-1"><VitalityBar current={creature.currentHp} max={creature.maxHp} /></div>
    </div>
  );
}

function BattleSprite({ creature, side, motion }: { creature: BattleCreatureState; side: "player" | "opponent"; motion: "idle" | "attack" | "hit" }) {
  const state = creature.fainted ? "faint" : motion;
  return (
    <div className="pixel-monster-motion" data-motion={state} data-side={side}>
      <div className="border border-slate-800 bg-[#050b17] sm:hidden"><PixelMonster speciesId={creature.speciesId} variant="battle-front" scale={2} alt={`${creature.speciesName} battle sprite`} priority className="pixel-monster-sprite h-32 w-32" /></div>
      <div className="hidden border border-slate-800 bg-[#050b17] sm:block"><PixelMonster speciesId={creature.speciesId} variant="battle-front" scale={3} alt={`${creature.speciesName} battle sprite`} priority className="pixel-monster-sprite h-48 w-48" /></div>
    </div>
  );
}

function BenchUnit({ creature, clickable, onClick }: { creature: BattleCreatureState; clickable?: boolean; onClick?: () => void }) {
  const disabled = creature.fainted || !clickable;
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`flex min-h-14 items-center gap-2 border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${disabled ? "cursor-not-allowed border-slate-800 bg-[#050b17] opacity-45" : "border-amber-300/60 bg-amber-300/5 hover:bg-amber-300/10"}`}>
      <PixelMonster speciesId={creature.speciesId} variant="overworld" alt="" decorative className={`h-9 w-9 ${creature.fainted ? "grayscale" : ""}`} />
      <span className="min-w-0"><span className="block truncate font-mono text-[10px] font-black uppercase text-slate-200">{creature.speciesName}</span><span className="mt-1 block font-mono text-[9px] uppercase text-slate-500">{creature.fainted ? "Fainted" : `HP ${creature.currentHp}/${creature.maxHp}`}</span></span>
    </button>
  );
}

function BattleFeed({ logs }: { logs: BattleLogEntry[] }) {
  const recentLogs = [...logs].reverse().slice(0, 8);
  return (
    <section className="border border-slate-700 bg-[#07101f]" aria-labelledby="battle-feed-title">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-3"><div><p className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Resolution feed</p><h2 id="battle-feed-title" className="mt-1 font-mono text-sm font-black uppercase text-slate-100">Battle log</h2></div><span className="font-mono text-[9px] font-black uppercase tracking-[0.1em] text-amber-200">Live</span></div>
      <ul className="max-h-52 space-y-2 overflow-y-auto px-3 py-3 text-xs">
        {recentLogs.length ? recentLogs.map((entry, index) => <li key={`${entry.turn}-${index}`} className={entry.type === "faint" ? "text-rose-300" : entry.type === "battle_end" ? "font-bold text-amber-200" : entry.type === "switch" ? "text-sky-200" : "text-slate-400"}><span className="mr-2 font-mono text-[9px] text-slate-600">T{entry.turn}</span>{entry.message}</li>) : <li className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">Awaiting first command.</li>}
      </ul>
    </section>
  );
}

function CommandBoard({ player, pending, showSkills, onAction, onToggleSkills, onToggleSwitch, showSwitch }: { player: BattleCreatureState | undefined; pending: boolean; showSkills: boolean; showSwitch: boolean; onAction: (action: BattleAction) => void; onToggleSkills: () => void; onToggleSwitch: () => void }) {
  const neutral = "border-slate-700 bg-[#050b17] text-slate-300 hover:border-slate-500";
  const selected = "border-amber-300 bg-amber-300/10 text-amber-100";
  return (
    <section className="border border-slate-700 bg-[#07101f]" aria-labelledby="battle-command-title">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-3"><div><p className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Tactical input</p><h2 id="battle-command-title" className="mt-1 font-mono text-sm font-black uppercase text-slate-100">Command pad</h2></div><span className="font-mono text-[9px] uppercase tracking-[0.1em] text-slate-500">One action / turn</span></div>
      <div className="grid grid-cols-2 gap-2 p-3 md:grid-cols-4">
        <button type="button" disabled={pending} onClick={() => onAction({ type: "basic_attack" })} className="border border-amber-300 bg-amber-300 px-3 py-3 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-slate-950 transition-colors hover:bg-amber-200 disabled:opacity-50">Attack</button>
        <button type="button" disabled={pending} onClick={onToggleSkills} className={`border px-3 py-3 font-mono text-[10px] font-black uppercase tracking-[0.1em] transition-colors disabled:opacity-50 ${showSkills ? selected : neutral}`}>Skill</button>
        <button type="button" disabled={pending} onClick={() => onAction({ type: "defend" })} className={`border px-3 py-3 font-mono text-[10px] font-black uppercase tracking-[0.1em] transition-colors disabled:opacity-50 ${neutral}`}>Defend</button>
        <button type="button" disabled={pending} onClick={onToggleSwitch} className={`border px-3 py-3 font-mono text-[10px] font-black uppercase tracking-[0.1em] transition-colors disabled:opacity-50 ${showSwitch ? selected : neutral}`}>Switch</button>
      </div>
      {showSkills && player ? <div className="grid gap-2 border-t border-slate-800 p-3 sm:grid-cols-2">{player.skills.map((skill) => <button key={skill.id} type="button" disabled={pending} onClick={() => onAction({ type: "skill", skillId: skill.id })} className="flex items-center justify-between border border-slate-700 bg-[#050b17] px-3 py-3 text-left transition-colors hover:border-amber-300/60 disabled:opacity-50"><span><span className="block font-mono text-xs font-black uppercase text-slate-100">{skill.name}</span><span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.08em] text-slate-500">PWR {skill.power} · ACC {skill.accuracy}</span></span><span className="font-mono text-[9px] font-black uppercase text-amber-200">{skill.element}</span></button>)}</div> : null}
    </section>
  );
}

export function BattleArena({ initialState, initialLogs, initialRewards = null }: BattleArenaProps) {
  const [battle, setBattle] = useState<BattleState>(initialState);
  const [logs, setLogs] = useState<BattleLogEntry[]>(initialLogs);
  const [rewards, setRewards] = useState<BattleRewardSettlement | null>(initialRewards);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [showSwitch, setShowSwitch] = useState(false);
  const [motion, setMotion] = useState<{ player: "idle" | "attack" | "hit"; opponent: "idle" | "attack" | "hit" }>({ player: "idle", opponent: "idle" });
  const [, startTransition] = useTransition();
  const player = battle.playerTeam[battle.playerActiveIndex];
  const opponent = battle.opponentTeam[battle.opponentActiveIndex];
  const finished = battle.status === "completed";

  function submit(action: BattleAction) {
    if (pending || finished) return;
    setError(null);
    setShowSkills(false);
    setShowSwitch(false);
    if (action.type === "basic_attack" || action.type === "skill") setMotion({ player: "attack", opponent: "hit" });
    else if (action.type === "switch") setMotion({ player: "hit", opponent: "idle" });
    window.setTimeout(() => setMotion({ player: "idle", opponent: "idle" }), 520);
    setPending(true);
    startTransition(async () => {
      const result = await submitAction({ battleId: battle.id, expectedTurn: battle.turn, action });
      setPending(false);
      if (result.ok && result.state) {
        setBattle(result.state);
        if (result.logs && result.logs.length) setLogs((previous) => [...previous, ...(result.logs ?? [])]);
        if (result.rewards) setRewards(result.rewards);
      } else if (result.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <section className="border-2 border-slate-700 bg-[#07101f]" aria-labelledby="arena-field-title">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><div><p className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Battlefield</p><h2 id="arena-field-title" className="mt-1 font-mono text-sm font-black uppercase text-slate-100">Live creature field</h2></div><p className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-amber-200">Turn {battle.turn}</p></div>
        <div className="relative min-h-[32rem] overflow-hidden bg-[#050b17] sm:min-h-[29rem]">
          <div className="bg-grid absolute inset-0 opacity-30" aria-hidden="true" />
          {opponent ? <div className="absolute left-3 right-36 top-4 z-10 sm:left-7 sm:right-auto sm:w-80"><BattleHud creature={opponent} side="opponent" /></div> : null}
          {opponent ? <div className="absolute right-3 top-16 z-10 sm:right-12 sm:top-10"><BattleSprite creature={opponent} side="opponent" motion={motion.opponent} /></div> : null}
          {player ? <div className="absolute bottom-7 left-3 z-10 sm:bottom-8 sm:left-12"><BattleSprite creature={player} side="player" motion={motion.player} /></div> : null}
          {player ? <div className="absolute bottom-5 left-36 right-3 z-10 sm:bottom-10 sm:left-auto sm:right-7 sm:w-80"><BattleHud creature={player} side="player" /></div> : null}
          <p className="absolute left-3 top-36 z-10 font-mono text-[9px] font-black uppercase tracking-[0.14em] text-slate-600 sm:left-7 sm:top-48">Enemy upper field</p>
          <p className="absolute bottom-3 left-3 z-10 font-mono text-[9px] font-black uppercase tracking-[0.14em] text-slate-600 sm:bottom-3 sm:left-7">Player lower field</p>
        </div>
        <div className="grid gap-3 border-t border-slate-800 p-3 md:grid-cols-2 sm:p-4">
          <div><p className="mb-2 font-mono text-[9px] font-black uppercase tracking-[0.14em] text-amber-200">Player reserves</p><div className="grid grid-cols-2 gap-2">{battle.playerTeam.map((creature, index) => index === battle.playerActiveIndex ? null : <BenchUnit key={creature.battleMonsterId} creature={creature} clickable={showSwitch} onClick={() => showSwitch && submit({ type: "switch", targetBattleMonsterId: creature.battleMonsterId })} />)}</div></div>
          <div><p className="mb-2 font-mono text-[9px] font-black uppercase tracking-[0.14em] text-violet-200">Opponent reserves</p><div className="grid grid-cols-2 gap-2">{battle.opponentTeam.map((creature, index) => index === battle.opponentActiveIndex ? null : <BenchUnit key={creature.battleMonsterId} creature={creature} />)}</div></div>
        </div>
      </section>

      {finished ? <ResultPanel battle={battle} playerSurvivors={battle.playerTeam.filter((creature) => !creature.fainted).length} rewards={rewards} /> : <><CommandBoard player={player} pending={pending} showSkills={showSkills} showSwitch={showSwitch} onAction={submit} onToggleSkills={() => { setShowSkills((value) => !value); setShowSwitch(false); }} onToggleSwitch={() => { setShowSwitch((value) => !value); setShowSkills(false); }} /><BattleFeed logs={logs} /></>}
      {showSwitch && !finished ? <p className="border border-amber-300/40 bg-amber-300/5 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-amber-100">Choose an available player reserve to switch. Fainted units are locked.</p> : null}
      {pending ? <p aria-live="polite" className="border border-amber-300/40 bg-amber-300/5 px-3 py-2 text-center font-mono text-[10px] font-black uppercase tracking-[0.12em] text-amber-200">Resolving server-authoritative turn…</p> : null}
      {error ? <p role="alert" className="border border-rose-400/50 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</p> : null}
    </div>
  );
}

function ResultPanel({ battle, playerSurvivors, rewards }: { battle: BattleState; playerSurvivors: number; rewards: BattleRewardSettlement | null }) {
  const victory = battle.winner === "player";
  return (
    <section className={`border-2 p-5 text-center ${victory ? "border-emerald-400/70 bg-emerald-400/5" : "border-rose-400/70 bg-rose-400/5"}`}>
      <p className={`font-mono text-[10px] font-black uppercase tracking-[0.18em] ${victory ? "text-emerald-300" : "text-rose-300"}`}>{victory ? "Match resolved // victory" : "Match resolved // defeat"}</p>
      <h2 className="mt-2 font-mono text-2xl font-black uppercase text-slate-100">{victory ? "Battle won" : "Battle lost"}</h2>
      <p className="mt-2 text-xs text-slate-400">Battle ended in {Math.max(0, battle.turn - 1)} turns{victory ? ` · ${playerSurvivors} survivor(s)` : ""}.</p>
      {rewards ? <div className="mx-auto mt-4 max-w-xl border border-slate-700 bg-[#050b17] p-3 text-left"><p className="font-mono text-xs font-black uppercase text-amber-200">Gold +{rewards.gold}</p><ul className="mt-2 space-y-1 text-xs text-slate-400">{rewards.monsters.map((entry) => <li key={entry.monsterId}>EXP +{entry.expGained}{entry.newLevel > entry.oldLevel ? ` · Lv ${entry.oldLevel} → ${entry.newLevel}` : ""}{entry.unlockedSkills.length ? ` · New skill: ${entry.unlockedSkills.join(", ")}` : ""}</li>)}</ul>{rewards.items.length ? <p className="mt-2 text-xs text-slate-400">Items: {rewards.items.map((item) => `${item.itemSlug} ×${item.quantity}`).join(", ")}</p> : null}</div> : null}
      <div className="mt-5 flex flex-wrap justify-center gap-2"><Link href="/battle" className="border border-amber-300 bg-amber-300 px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-slate-950 transition-colors hover:bg-amber-200">Battle again</Link><Link href="/monsters" className="border border-slate-600 bg-[#050b17] px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-slate-300 transition-colors hover:border-amber-300 hover:text-amber-100">View collection</Link>{!victory ? <Link href="/team" className="border border-slate-600 bg-[#050b17] px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-slate-300 transition-colors hover:border-amber-300 hover:text-amber-100">Edit team</Link> : null}</div>
    </section>
  );
}
