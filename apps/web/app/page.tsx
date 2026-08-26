import Link from "next/link";

const GAME_LOOP = [
  "Explore",
  "Encounter",
  "Capture",
  "Collect",
  "Team",
  "Battle",
  "Evolve",
  "NFT",
] as const;

const FEATURES = [
  {
    icon: "🗺️",
    title: "Explore",
    text: "Four zones — Forest, Lake, Volcano and Power Plant — each with its own wild monster population.",
  },
  {
    icon: "🥚",
    title: "Capture",
    text: "Encounter wild monsters and throw capture balls. Rarity, HP and ball grade decide your odds.",
  },
  {
    icon: "⚔️",
    title: "3v3 Battle",
    text: "Build a team of three and fight turn-based battles with element advantages.",
  },
  {
    icon: "⬆️",
    title: "Evolve",
    text: "Level up, learn skills and evolve your monsters through multi-stage evolution lines.",
  },
  {
    icon: "⛓️",
    title: "NFT Ownership",
    text: "Monsters become ERC-721 NFTs on-chain with DNA, lineage and battle history.",
  },
] as const;

const ONBOARDING = [
  "连接你的 EVM 钱包",
  "主动签署可读的登录消息",
  "选择一张像素世界地图",
  "捕捉、收集、组队与战斗",
] as const;

export default function HomePage() {
  return (
    <div className="animate-fade-in-up">
      {/* Hero */}
      <section className="bg-grid relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 px-6 py-20 text-center">
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">
            Pixel RPG × Monster Collection × On-chain Ownership
          </p>
          <h1 className="mt-4 bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 bg-clip-text text-5xl font-black tracking-tight text-transparent md:text-6xl">
            ChainMon
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-300">
            从连接钱包开始你的个人冒险。探索四张像素世界，捕捉 ChainMon、训练队伍，并在你主动选择时体验链上所有权。
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="rounded-xl bg-amber-500 px-6 py-3 font-semibold text-slate-950 transition-colors hover:bg-amber-400"
            >
              连接钱包
            </Link>
            <Link
              href="/monsters"
              className="rounded-xl border border-slate-700 bg-slate-800/60 px-6 py-3 font-semibold text-slate-200 transition-colors hover:bg-slate-800"
            >
              查看图鉴
            </Link>
          </div>
        </div>
      </section>

      {/* Game loop */}
      <section className="mt-12">
        <h2 className="text-center text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
          The Core Loop
        </h2>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {GAME_LOOP.map((step, index) => (
            <span key={step} className="flex items-center gap-2">
              <span className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-200">
                {step}
              </span>
              {index < GAME_LOOP.length - 1 ? (
                <span className="text-slate-600">→</span>
              ) : null}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition-colors hover:border-slate-700"
          >
            <div className="text-3xl">{feature.icon}</div>
            <h3 className="mt-3 font-semibold text-slate-100">{feature.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{feature.text}</p>
          </div>
        ))}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h3 className="font-semibold text-slate-100">新玩家流程</h3>
          <ul className="mt-3 space-y-1.5">
            {ONBOARDING.map((step, index) => (
              <li key={step} className="flex items-center gap-2 text-sm">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-400">
                  {index + 1}
                </span>
                <span className="text-slate-300">{step}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
