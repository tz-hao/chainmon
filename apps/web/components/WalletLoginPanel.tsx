"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSignMessage,
  useSwitchChain,
} from "wagmi";
import { chainmonChain } from "@/lib/web3/chain";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

interface Eip1193Provider {
  request(args: { method: string }): Promise<unknown>;
  on?(event: "chainChanged", listener: (chainId: string) => void): void;
  removeListener?(event: "chainChanged", listener: (chainId: string) => void): void;
}

function parseWalletChainId(value: unknown): number | null {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) return null;
  const chainId = Number.parseInt(value, 16);
  return Number.isSafeInteger(chainId) ? chainId : null;
}

/** Wallet-first login: connection is harmless; signing needs a second click. */
export function WalletLoginPanel() {
  const router = useRouter();
  const { address, connector: connectedConnector, isConnected } = useAccount();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switchingChain } = useSwitchChain();
  const { signMessageAsync } = useSignMessage();
  const [mounted, setMounted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletChainId, setWalletChainId] = useState<number | null | undefined>(undefined);

  const connector = connectors[0];
  const activeConnector =
    connectedConnector && typeof connectedConnector.getProvider === "function"
      ? connectedConnector
      : connector;
  const wrongNetwork = isConnected && typeof walletChainId === "number" && walletChainId !== chainmonChain.id;
  const networkChecking = isConnected && walletChainId === undefined;
  const networkUnavailable = isConnected && walletChainId === null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let provider: Eip1193Provider | undefined;
    const readChainId = async () => {
      try {
        const chainId = parseWalletChainId(
          await provider?.request({ method: "eth_chainId" }),
        );
        if (!cancelled) setWalletChainId(chainId);
      } catch {
        if (!cancelled) setWalletChainId(null);
      }
    };
    const onChainChanged = () => void readChainId();

    if (!isConnected || !activeConnector) {
      setWalletChainId(undefined);
      return;
    }
    void activeConnector.getProvider().then((candidate) => {
      provider = candidate as Eip1193Provider;
      provider.on?.("chainChanged", onChainChanged);
      return readChainId();
    }).catch(() => {
      if (!cancelled) setWalletChainId(null);
    });

    return () => {
      cancelled = true;
      provider?.removeListener?.("chainChanged", onChainChanged);
    };
  }, [activeConnector, isConnected]);

  async function signIn() {
    if (!address || !activeConnector) return;
    try {
      const provider = (await activeConnector.getProvider()) as Eip1193Provider;
      const actualChainId = parseWalletChainId(
        await provider.request({ method: "eth_chainId" }),
      );
      if (actualChainId !== chainmonChain.id) {
        setError(`请先将钱包切换到 ${chainmonChain.name}（Chain ID ${chainmonChain.id}）。`);
        setConfirming(false);
        return;
      }
    } catch {
      setError("无法确认当前钱包网络。请重新连接钱包后再试。");
      setConfirming(false);
      return;
    }
    setSigning(true);
    setError(null);
    try {
      const nonceResponse = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ address }),
      });
      const challenge = (await nonceResponse.json()) as { message?: string; error?: string };
      if (!nonceResponse.ok || !challenge.message) {
        throw new Error(challenge.error ?? "Could not create a sign-in message.");
      }
      const signature = await signMessageAsync({ message: challenge.message });
      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ message: challenge.message, signature }),
      });
      const result = (await verifyResponse.json()) as { ok?: boolean; error?: string };
      if (!verifyResponse.ok || !result.ok) {
        throw new Error(result.error ?? "Wallet login failed.");
      }
      router.replace("/world/select");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wallet login failed.");
      setConfirming(false);
    } finally {
      setSigning(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl">
      <div className="text-3xl">🎒</div>
      <h1 className="mt-3 text-2xl font-bold text-white">开始你的 ChainMon 冒险</h1>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        连接常用 EVM 钱包后，再由你主动签署标准登录消息。钱包地址就是你的 ChainMon 账号。
      </p>

      {!mounted || !isConnected || !address ? (
        <button
          type="button"
          disabled={!connector || connecting}
          onClick={() => connector && connect({ connector })}
          className="mt-6 w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {connecting ? "正在连接钱包…" : "连接钱包"}
        </button>
      ) : (
        <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Wallet connected</p>
          <p className="mt-1 font-mono text-sm text-slate-100">{shortAddress(address)}</p>
          <div className="mt-4 flex gap-2">
            {wrongNetwork ? (
              <button
                type="button"
                disabled={switchingChain}
                onClick={() => switchChain({ chainId: chainmonChain.id })}
                className="flex-1 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-extrabold text-slate-950 hover:bg-amber-300 disabled:opacity-50"
              >
                {switchingChain ? "正在切换网络…" : `切换到 ${chainmonChain.name}`}
              </button>
            ) : (
              <button
                type="button"
                disabled={signing || networkChecking || networkUnavailable}
                onClick={() => {
                  setError(null);
                  setConfirming(true);
                }}
                className="flex-1 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-extrabold text-slate-950 hover:bg-amber-300 disabled:opacity-50"
              >
                {networkChecking ? "正在验证钱包网络…" : "登录 ChainMon"}
              </button>
            )}
            <button
              type="button"
              disabled={signing}
              onClick={() => disconnect()}
              className="rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              断开
            </button>
          </div>
          {wrongNetwork ? (
            <p role="alert" className="mt-3 text-xs leading-5 text-amber-200">
              当前钱包网络不是 {chainmonChain.name}（Chain ID {chainmonChain.id}）。ChainMon 不会在错误网络上发起登录签名。
            </p>
          ) : null}
          {networkUnavailable ? (
            <p role="alert" className="mt-3 text-xs leading-5 text-amber-200">
              无法确认当前钱包网络；为保护登录签名，请重新连接钱包后再试。
            </p>
          ) : null}
        </div>
      )}

      {confirming ? (
        <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-50">
          <h2 className="font-bold">验证钱包所有权</h2>
          <p className="mt-2">ChainMon 需要一个登录签名来确认这个钱包属于你。</p>
          <ul className="mt-2 list-inside list-disc text-xs text-amber-100">
            <li>不会发送区块链交易</li>
            <li>不会消耗 MON</li>
            <li>不会授权 Token 或 NFT</li>
            <li>不会转移任何资产</li>
          </ul>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={signing}
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-amber-200/30 px-3 py-2 text-xs font-bold hover:bg-amber-100/10"
            >
              取消
            </button>
            <button
              type="button"
              disabled={signing}
              onClick={() => void signIn()}
              className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-extrabold text-slate-950 hover:bg-amber-300 disabled:opacity-50"
            >
              {signing ? "正在签名并登录…" : "签名并登录"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p role="alert" className="mt-4 text-sm text-red-300">{error}</p> : null}
      <p className="mt-4 text-xs leading-5 text-slate-500">
        登录签名不会切换网络，也不会产生 Gas。NFT 与 Marketplace 会在你主动操作时单独提示 Monad Testnet 交易。
      </p>
    </div>
  );
}
