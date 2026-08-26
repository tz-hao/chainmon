"use client";

interface GuideOverlayProps {
  onClose: () => void;
  variant?: "first-visit" | "guide";
}

/** A concise, repeatable world guide; first visits use the lighter welcome variant. */
export function GuideOverlay({ onClose, variant = "guide" }: GuideOverlayProps) {
  const firstVisit = variant === "first-visit";

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <h2 className="text-lg font-bold text-white">
          {firstVisit ? "欢迎来到 ChainMon！" : "新手指南 / Trainer Guide"}
        </h2>
        {firstVisit ? (
          <p className="mt-2 text-sm text-slate-300">
            先探索、再捕捉。你的冒险可从森林、湖泊、火山或发电厂开始。
          </p>
        ) : null}
        <div className="mt-4 space-y-2 text-sm text-slate-200">
          <p><span className="font-bold text-sky-300">1. 移动：</span>WASD 或方向键探索地图。</p>
          <p><span className="font-bold text-emerald-300">2. 地图：</span>点击左上角 🗺 地图，返回区域选择；当前位置会正常保存。</p>
          <p><span className="font-bold text-cyan-300">3. 遇怪：</span>靠近带 ✦ 标记的野生精灵，接触即可遭遇；也可按 E。</p>
          <p><span className="font-bold text-amber-300">4. 捕捉球：</span>选择捕捉球后点击 Throw Ball。失败可以继续投掷，Run 会离开遭遇。</p>
          <p><span className="font-bold text-violet-300">5. 补给：</span>领取 Daily Supply、拾取发光补给，或到 BALL SHOP 购买捕捉球。</p>
          <p><span className="font-bold text-rose-300">6. 成长：</span>捕捉后到 Collection 查看，组建 Team 后可 Battle 与 Evolution。</p>
          <p><span className="font-bold text-slate-200">7. 钱包 / NFT：</span>钱包就是你的 ChainMon 账号。登录签名不会花费资产；普通探索不需要签名，链上功能仅在你主动开启时使用。</p>
        </div>
        <div className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs text-emerald-100">
          推荐先离开营地，前往带 ✦ 标记的野生精灵，完成第一次捕捉。需要换区域时点击 🗺 地图。
        </div>
        {firstVisit ? (
          <p className="mt-3 text-center text-[11px] text-slate-400">以后可随时点击左上角“新手指南 / Guide”再次查看。</p>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-600"
        >
          {firstVisit ? "开始冒险" : "知道了"}
        </button>
      </div>
    </div>
  );
}
