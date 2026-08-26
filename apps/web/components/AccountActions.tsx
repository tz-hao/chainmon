"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDisconnect } from "wagmi";

/** Logout clears the local ChainMon session and the injected-wallet UI state. */
export function AccountActions() {
  const router = useRouter();
  const { disconnect } = useDisconnect();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setSigningOut(true);
    setError(null);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      window.dispatchEvent(new Event("chainmon-session-cleared"));
      disconnect();
      router.replace("/login");
      router.refresh();
    } catch {
      setError("无法完成退出登录，请重试。");
      setSigningOut(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled
        className="w-full cursor-not-allowed rounded-lg bg-slate-800 px-4 py-2.5 text-left text-sm font-medium text-slate-500"
      >
        Change nickname（将在后续账户设置开放）
      </button>
      <button
        type="button"
        onClick={() => void signOut()}
        disabled={signingOut}
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-left text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
      >
        {signingOut ? "正在退出…" : "退出登录"}
      </button>
      {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
