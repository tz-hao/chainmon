import Link from "next/link";

function FeatureIcon({ kind }: { kind: "creature" | "battle" | "chain" }) {
  const common = {
    className: "h-6 w-6",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (kind === "creature") {
    return <svg {...common}><path d="M5 9 3 4l6 2m10 3 2-5-6 2" /><path d="M5 9a7 7 0 1 0 14 0c0-2-2-3-4-3H9C7 6 5 7 5 9Z" /><path d="M9 12h.01M15 12h.01M9 16c2 1 4 1 6 0" /></svg>;
  }
  if (kind === "battle") {
    return <svg {...common}><path d="m5 3 6 6-2 2-6-6V3h2Zm14 0-6 6 2 2 6-6V3h-2Z" /><path d="m8 12-5 5 4 4 5-5m4-4 5 5-4 4-5-5" /></svg>;
  }
  return <svg {...common}><path d="M9 7H7a5 5 0 0 0 0 10h2m6-10h2a5 5 0 0 1 0 10h-2M8 12h8" /></svg>;
}

const PILLARS = [
  {
    kind: "creature" as const,
    title: "Protocol creatures",
    text: "Build a persistent collection of 28 species with DNA, skills, levels, rarity and evolution.",
  },
  {
    kind: "battle" as const,
    title: "Tactical expeditions",
    text: "Navigate Rift nodes and resolve Attack, Skill, Defend and Switch commands one turn at a time.",
  },
  {
    kind: "chain" as const,
    title: "Ownership by choice",
    text: "Progress off-chain, then choose if and when a monster becomes an on-chain Monad Testnet NFT.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <section className="rift-panel relative overflow-hidden px-6 py-16 text-center sm:px-10 sm:py-24">
        <div className="rift-map-grid absolute inset-0 opacity-45" aria-hidden="true" />
        <div className="rift-aurora absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 -translate-y-1/3 rounded-full" aria-hidden="true" />
        <div className="relative mx-auto max-w-4xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">
            Monster collection × protocol expeditions
          </p>
          <h1 className="mt-6 text-5xl font-black tracking-[-0.05em] text-white sm:text-7xl lg:text-8xl">
            ChainMon
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-medium text-slate-200 sm:text-xl">
            Protocol Creatures. Tactical Battles. On-chain Ownership.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
            进入协议裂隙，部署你的怪物队伍，在战斗与 Web3 协议事件中做出选择，并把真实成长带回收藏。
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/rift" className="rift-button-primary">Enter the Rift · 进入协议裂隙</Link>
            <Link href="/monsters" className="rift-button-secondary">View creature registry</Link>
          </div>
          <p className="mt-5 text-xs text-slate-500">Connect never auto-signs. Rift play never auto-mints.</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="ChainMon product pillars">
        {PILLARS.map((pillar, index) => (
          <article key={pillar.title} className="rift-panel">
            <div className="flex items-center justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/5 text-cyan-200">
                <FeatureIcon kind={pillar.kind} />
              </span>
              <span className="font-mono text-xs text-slate-600">0{index + 1}</span>
            </div>
            <h2 className="mt-6 text-xl font-bold text-white">{pillar.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">{pillar.text}</p>
          </article>
        ))}
      </section>

      <section className="rift-panel flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="rift-kicker">Pixel World route</p>
          <h2 className="mt-3 text-2xl font-bold text-white">Explore the original regions</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Explore Forest, Lake, Volcano and Power Station through the original Phaser experience at any time.</p>
        </div>
        <Link href="/world/select" className="rift-button-secondary shrink-0">Open Pixel World</Link>
      </section>
    </div>
  );
}
