"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type {
  BattleAction,
  BattleCreatureState,
  BattleLogEntry,
  BattleState,
} from "@chainmon/game-engine";
import type { BattleRewardSettlement } from "@/lib/data";
import { submitAction } from "@/actions/battle-round";
import { ElementBadge } from "./ElementBadge";
import { HpBar } from "./HpBar";
import { RarityBadge } from "./RarityBadge";

interface BattleArenaProps {
  initialState: BattleState;
  initialLogs: BattleLogEntry[];
  speciesImages: Record<number, string>;
  initialRewards?: BattleRewardSettlement | null;
}

function CreatureCard({
  creature,
  image,
  side,
}: {
  creature: BattleCreatureState;
  image: string;
  side: "player" | "opponent";
}) {
  const fainted = creature.fainted;
  return (
    <div
      className={`rounded-2xl border p-4 transition-all ${
        fainted
          ? "border-slate-800 bg-slate-950/60 opacity-50"
          : "border-slate-700 bg-slate-900/80"
      } ${side === "player" ? "ring-1 ring-amber-500/20" : ""}`}
    >
      <div className="flex items-center gap-3">
        <img
          src={image}
          alt={creature.speciesName}
          width={64}
          height={64}
          className={`h-16 w-16 rounded-xl bg-slate-950/40 object-cover ${
            fainted ? "grayscale" : ""
          }`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-bold text-slate-100">{creature.speciesName}</p>
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-500/30">
              Lv {creature.level}
            </span>
            {fainted ? (
              <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-300 ring-1 ring-red-500/30">
                Fainted
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex gap-1.5">
            <ElementBadge element={creature.element} />
            <RarityBadge rarity={creature.rarity} />
          </div>
          <div className="mt-2">
            <div className="mb-1 flex justify-between text-[10px] text-slate-500">
              <span>HP</span>
              <span className="tabular-nums">
                {creature.currentHp} / {creature.maxHp}
              </span>
            </div>
            <HpBar current={creature.currentHp} max={creature.maxHp} />
          </div>
        </div>
      </div>
    </div>
  );
}

function BenchCard({
  creature,
  image,
  isActive,
  onClick,
  clickable,
}: {
  creature: BattleCreatureState;
  image: string;
  isActive: boolean;
  onClick?: () => void;
  clickable?: boolean;
}) {
  const disabled = creature.fainted || isActive || !clickable;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl border p-2 text-left transition-colors ${
        isActive
          ? "border-amber-500/40 bg-amber-500/10"
          : disabled
            ? "cursor-not-allowed border-slate-800 bg-slate-950/50 opacity-50"
            : "border-slate-700 bg-slate-900/60 hover:border-amber-500/40"
      }`}
    >
      <div className="flex items-center gap-2">
        <img
          src={image}
          alt=""
          width={36}
          height={36}
          className={`h-9 w-9 rounded-lg bg-slate-950/40 object-cover ${
            creature.fainted ? "grayscale" : ""
          }`}
        />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-200">
            {creature.speciesName}
            {isActive ? " (active)" : ""}
          </p>
          <p className="text-[10px] tabular-nums text-slate-500">
            {creature.fainted
              ? "Fainted"
              : `HP ${creature.currentHp}/${creature.maxHp}`}
          </p>
        </div>
      </div>
    </button>
  );
}

export function BattleArena({
  initialState,
  initialLogs,
  speciesImages,
  initialRewards = null,
}: BattleArenaProps) {
  const [battle, setBattle] = useState<BattleState>(initialState);
  const [logs, setLogs] = useState<BattleLogEntry[]>(initialLogs);
  const [rewards, setRewards] = useState<BattleRewardSettlement | null>(
    initialRewards,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [showSwitch, setShowSwitch] = useState(false);
  const [, startTransition] = useTransition();

  const player = battle.playerTeam[battle.playerActiveIndex];
  const ai = battle.opponentTeam[battle.opponentActiveIndex];
  const finished = battle.status === "completed";

  function submit(action: BattleAction) {
    if (pending || finished) return;
    setError(null);
    setShowSkills(false);
    setShowSwitch(false);
    setPending(true);
    startTransition(async () => {
      const result = await submitAction({
        battleId: battle.id,
        expectedTurn: battle.turn,
        action,
      });
      setPending(false);
      if (result.ok && result.state) {
        setBattle(result.state);
        if (result.logs && result.logs.length > 0) {
          setLogs((prev) => [...prev, ...(result.logs ?? [])]);
        }
        if (result.rewards) {
          setRewards(result.rewards);
        }
      } else if (result.error) {
        setError(result.error);
      }
    });
  }

  const recentLogs = [...logs].reverse().slice(0, 12);

  return (
    <div className="space-y-6">
      {/* Opponent */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            AI Trainer
          </h2>
          <span className="text-xs text-slate-500">Turn {battle.turn}</span>
        </div>
        {ai ? (
          <CreatureCard
            creature={ai}
            image={
              speciesImages[ai.speciesId] ?? "/monsters/placeholder.svg"
            }
            side="opponent"
          />
        ) : null}
        <div className="mt-2 grid grid-cols-2 gap-2">
          {battle.opponentTeam.map((creature, index) =>
            index === battle.opponentActiveIndex ? null : (
              <BenchCard
                key={creature.battleMonsterId}
                creature={creature}
                image={
                  speciesImages[creature.speciesId] ??
                  "/monsters/placeholder.svg"
                }
                isActive={false}
              />
            ),
          )}
        </div>
      </section>

      {/* Battle log */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Battle Log
        </h2>
        <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-2 text-sm">
          {recentLogs.map((entry, index) => (
            <li
              key={`${entry.turn}-${index}`}
              className={
                entry.type === "faint"
                  ? "font-semibold text-red-300"
                  : entry.type === "battle_end"
                    ? "font-bold text-amber-300"
                    : entry.type === "switch"
                      ? "text-sky-300"
                      : "text-slate-400"
              }
            >
              <span className="mr-1.5 text-xs text-slate-600">
                T{entry.turn}
              </span>
              {entry.message}
            </li>
          ))}
          {recentLogs.length === 0 ? (
            <li className="text-slate-500">The battle begins...</li>
          ) : null}
        </ul>
      </section>

      {/* Player */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Your Active Monster
        </h2>
        {player ? (
          <CreatureCard
            creature={player}
            image={speciesImages[player.speciesId] ?? "/monsters/placeholder.svg"}
            side="player"
          />
        ) : null}
        <div className="mt-2 grid grid-cols-2 gap-2">
          {battle.playerTeam.map((creature, index) =>
            index === battle.playerActiveIndex ? null : (
              <BenchCard
                key={creature.battleMonsterId}
                creature={creature}
                image={
                  speciesImages[creature.speciesId] ??
                  "/monsters/placeholder.svg"
                }
                isActive={false}
                clickable={showSwitch}
                onClick={() => {
                  if (showSwitch) {
                    submit({
                      type: "switch",
                      targetBattleMonsterId: creature.battleMonsterId,
                    });
                  }
                }}
              />
            ),
          )}
        </div>
      </section>

      {/* Controls / result */}
      {finished ? (
        <ResultPanel
          battle={battle}
          playerSurvivors={battle.playerTeam.filter((c) => !c.fainted).length}
          rewards={rewards}
        />
      ) : (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => submit({ type: "basic_attack" })}
              className="rounded-lg bg-amber-500 px-3 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
            >
              Attack
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setShowSkills((v) => !v);
                setShowSwitch(false);
              }}
              className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                showSkills
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                  : "border-slate-700 bg-slate-800/60 text-slate-200 hover:border-slate-600"
              }`}
            >
              Skill
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => submit({ type: "defend" })}
              className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-600 disabled:opacity-50"
            >
              Defend
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setShowSwitch((v) => !v);
                setShowSkills(false);
              }}
              className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                showSwitch
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                  : "border-slate-700 bg-slate-800/60 text-slate-200 hover:border-slate-600"
              }`}
            >
              Switch
            </button>
          </div>

          {showSkills && player ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {player.skills.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  disabled={pending}
                  onClick={() => submit({ type: "skill", skillId: skill.id })}
                  className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3 text-left transition-colors hover:border-amber-500/40 disabled:opacity-50"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      {skill.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      Power {skill.power} · Accuracy {skill.accuracy}
                    </p>
                  </div>
                  <ElementBadge element={skill.element} />
                </button>
              ))}
            </div>
          ) : null}

          {showSwitch ? (
            <p className="mt-3 text-xs text-slate-500">
              Click a bench monster to switch (fainted monsters are locked).
            </p>
          ) : null}

          {pending ? (
            <p className="mt-4 text-center text-sm font-semibold text-amber-300">
              Resolving...
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}

function ResultPanel({
  battle,
  playerSurvivors,
  rewards,
}: {
  battle: BattleState;
  playerSurvivors: number;
  rewards: BattleRewardSettlement | null;
}) {
  const victory = battle.winner === "player";
  return (
    <section
      className={`rounded-2xl border p-8 text-center ${
        victory
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-red-500/30 bg-red-500/10"
      }`}
    >
      <div className="text-5xl">{victory ? "🏆" : "💀"}</div>
      <h2
        className={`mt-3 text-3xl font-black ${
          victory ? "text-emerald-300" : "text-red-300"
        }`}
      >
        {victory ? "Victory!" : "Defeat"}
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        Battle ended in {Math.max(0, battle.turn - 1)} turns
        {victory ? ` · ${playerSurvivors} monster(s) survived` : ""}.
      </p>

      {/* Rewards (Phase 5) — read from the server snapshot, never computed here */}
      {rewards ? (
        <div className="mx-auto mt-5 max-w-md rounded-xl bg-slate-950/50 p-4 text-left">
          <p className="text-sm font-bold text-amber-300">
            Gold +{rewards.gold}
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {rewards.monsters.map((entry) => (
              <li key={entry.monsterId} className="text-slate-300">
                <span className="font-semibold text-slate-200">
                  {entry.expGained > 0 ? `EXP +${entry.expGained}` : "EXP +0"}
                </span>
                {entry.newLevel > entry.oldLevel ? (
                  <span className="ml-2 font-bold text-emerald-300">
                    Lv {entry.oldLevel} → Lv {entry.newLevel}
                  </span>
                ) : null}
                {entry.unlockedSkills.length > 0 ? (
                  <span className="ml-2 text-sky-300">
                    New Skill: {entry.unlockedSkills.join(", ")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {rewards.items.length > 0 ? (
            <p className="mt-2 text-sm text-slate-300">
              Item:{" "}
              {rewards.items
                .map((item) => `${item.itemSlug} ×${item.quantity}`)
                .join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/battle"
          className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
        >
          Battle Again
        </Link>
        <Link
          href="/monsters"
          className="rounded-lg border border-slate-700 bg-slate-800/60 px-5 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800"
        >
          View Collection
        </Link>
        {!victory ? (
          <Link
            href="/team"
            className="rounded-lg border border-slate-700 bg-slate-800/60 px-5 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800"
          >
            Edit Team
          </Link>
        ) : null}
        {!victory ? (
          <Link
            href="/explore"
            className="rounded-lg border border-slate-700 bg-slate-800/60 px-5 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800"
          >
            Explore
          </Link>
        ) : null}
      </div>
    </section>
  );
}
