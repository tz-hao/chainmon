import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequiredExp } from "@chainmon/game-engine";
import { checkEvolutionEligibility } from "@chainmon/game-engine";
import type { MonsterDNA } from "@chainmon/shared";
import { getSpeciesById } from "@chainmon/monster-data";
import { ElementBadge } from "@/components/ElementBadge";
import { EvolutionPanel } from "@/components/EvolutionPanel";
import { PixelMonster } from "@/components/PixelMonster";
import { RarityBadge } from "@/components/RarityBadge";
import { SellPanel } from "@/components/SellPanel";
import { Web3Panel } from "@/components/Web3Panel";
import { KnowledgeCard } from "@/components/world/KnowledgeCard";
import { requirePageTrainer } from "@/lib/auth/current-trainer";

export const dynamic = "force-dynamic";

const DNA_ROWS: readonly { label: string; key: keyof MonsterDNA }[] = [
  { label: "HP Gene", key: "hpGene" },
  { label: "Attack Gene", key: "attackGene" },
  { label: "Defense Gene", key: "defenseGene" },
  { label: "Speed Gene", key: "speedGene" },
  { label: "Mutation Gene", key: "mutationGene" },
];

const STAT_ROWS = [
  { label: "HP", key: "hp", valueClass: "text-emerald-300" },
  { label: "Attack", key: "attack", valueClass: "text-red-300" },
  { label: "Defense", key: "defense", valueClass: "text-sky-300" },
  { label: "Speed", key: "speed", valueClass: "text-yellow-300" },
] as const;

interface MonsterDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function MonsterDetailPage({
  params,
}: MonsterDetailPageProps) {
  const { id } = await params;
  const { repository, trainer } = await requirePageTrainer();
  const monster = await repository.getMonster(id, trainer.id);
  if (!monster) {
    notFound();
  }

  const isOwner = monster.owner === trainer.id;
  const species = getSpeciesById(monster.speciesId);
  const inventory = await repository.getInventory(trainer.id);
  const target = species?.evolution?.evolvesTo
    ? getSpeciesById(species.evolution.evolvesTo)
    : undefined;
  const eligibility = species
    ? checkEvolutionEligibility(monster, species, inventory)
    : { eligible: false };
  const history = await repository.getEvolutionHistory(monster.id);
  const listing = isOwner
    ? await repository.getListingByMonster(monster.id)
    : null;

  const requiredExp = getRequiredExp(monster.level);
  const expPercent = Math.min(
    100,
    Math.round((monster.exp / Math.max(requiredExp, 1)) * 100),
  );

  return (
    <div className="animate-fade-in-up">
      <Link
        href="/monsters"
        className="text-sm text-slate-400 transition-colors hover:text-slate-200"
      >
        ← Back to collection
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        {/* Identity card */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 lg:col-span-1">
          <div className="flex h-64 w-64 items-center justify-center bg-slate-950/80">
            <PixelMonster
              speciesId={monster.speciesId}
              variant="portrait"
              scale={2}
              alt={monster.name}
              priority
            />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-100">
            {monster.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {species?.description ?? "Unknown species."}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <ElementBadge element={monster.element} />
            <span className="self-center text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Species rarity
            </span>
            <RarityBadge rarity={monster.rarity} />
            <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/30">
              Lv {monster.level}
            </span>
            {monster.speciesId >= 21 ? (
              <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-xs font-bold text-purple-300 ring-1 ring-purple-500/30">
                WEB3 CREATURE
              </span>
            ) : null}
          </div>

          {/* EXP progress (Phase 5) */}
          <div className="mt-4 rounded-xl bg-slate-950/40 p-3">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>EXP</span>
              <span className="tabular-nums">
                {monster.exp} / {requiredExp}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-500"
                style={{ width: `${expPercent}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-slate-600">
              {monster.level >= 50
                ? "Maximum level reached"
                : `${requiredExp - monster.exp} EXP to level ${monster.level + 1}`}
            </p>
          </div>

          <dl className="mt-4 space-y-2 border-t border-slate-800 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Species</dt>
              <dd className="text-slate-300">{species?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">NFT ID</dt>
              <dd className="text-slate-300">
                {monster.tokenId ?? "Not minted (Phase 6)"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Generation</dt>
              <dd className="text-slate-300">{monster.generation}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Battles / Wins</dt>
              <dd className="text-slate-300">
                {monster.battleCount} / {monster.wins}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Owner</dt>
              <dd className="max-w-[55%] truncate text-slate-300">
                {isOwner
                  ? "You"
                  : monster.onchainOwnerAddress
                    ? `${monster.onchainOwnerAddress.slice(0, 8)}...${monster.onchainOwnerAddress.slice(-6)}`
                    : monster.owner ?? "External owner"}
              </dd>
            </div>
            {!isOwner ? (
              <div className="flex justify-between">
                <dt className="text-slate-500">DNA</dt>
                <dd className="text-emerald-300">Verified ✅</dd>
              </div>
            ) : null}
          </dl>
        </section>

        {/* Stats, DNA, skills */}
        <section className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
              Stats
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {STAT_ROWS.map((row) => (
                <div
                  key={row.key}
                  className="rounded-xl bg-slate-800/60 p-4 text-center"
                >
                  <p className="text-xs text-slate-500">{row.label}</p>
                  <p className={`mt-1 text-2xl font-bold ${row.valueClass}`}>
                    {monster[row.key]}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
              DNA
            </h2>
            {isOwner ? (
              <>
                <div className="space-y-3">
                  {DNA_ROWS.map((row) => {
                    const value = monster.dna[row.key];
                    return (
                      <div key={row.key} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 text-xs text-slate-400">
                          {row.label}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                            style={{ width: `${value}%` }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right text-xs tabular-nums text-slate-300">
                          {value}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Genes (0-100) drive individual stat growth — every monster is
                  unique.
                </p>
              </>
            ) : (
              <p className="text-sm text-emerald-300">
                DNA Verified ✅ — individual genes are only visible to the
                owner.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
              Skills
            </h2>
            {monster.skills.length === 0 ? (
              <p className="text-sm text-slate-400">No skills learned yet.</p>
            ) : (
              <ul className="space-y-2">
                {monster.skills.map((skill) => (
                  <li
                    key={skill.id}
                    className="flex items-center justify-between rounded-xl bg-slate-800/60 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        {skill.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {skill.description}
                      </p>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      <ElementBadge element={skill.element} />
                      <p className="mt-1">
                        Power {skill.power} · Acc {skill.accuracy}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Web3 Knowledge (Web3 monsters only) */}
          <KnowledgeCard skillIds={monster.skills.map((s) => s.id)} />

          {isOwner ? (
            <>
              {/* On-chain asset (Phase 7) */}
              <Web3Panel monster={monster} />

              {/* Marketplace (Phase 8) */}
              <SellPanel monster={monster} listing={listing} />

              {/* Evolution (Phase 5) */}
              <EvolutionPanel
                monster={monster}
                species={species}
                target={target}
                eligibility={eligibility}
                inventory={inventory}
              />
            </>
          ) : null}
        </section>
      </div>

      {/* Evolution history */}
      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Evolution History
        </h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            No evolutions recorded yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {history.map((entry) => {
              const from = getSpeciesById(entry.fromSpeciesId);
              const to = getSpeciesById(entry.toSpeciesId);
              return (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-800/60 px-4 py-3 text-sm"
                >
                  <span className="font-semibold text-slate-200">
                    {from?.name ?? `#${entry.fromSpeciesId}`}
                  </span>
                  <span className="text-slate-500">↓</span>
                  <span className="font-semibold text-amber-300">
                    {to?.name ?? `#${entry.toSpeciesId}`}
                  </span>
                  <span className="ml-auto text-xs text-slate-500">
                    Evolved at Level {entry.level} ·{" "}
                    {entry.createdAt.toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

    </div>
  );
}
