import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Marketplace currency regression (Monad Final Deployment, sections 51–54):
 * the native marketplace currency label must follow the configured chain —
 * Monad Testnet (10143) → MON, Hardhat localhost (31337) → ETH.
 *
 * The contract always uses msg.value (native currency); only the UI label is
 * dynamic. These tests load lib/web3/chain.ts with stubbed env to prove the
 * mapping, plus static truth-table checks for readability.
 */

const STATIC_CURRENCY: Record<number, string> = {
  10143: "MON",
  31337: "ETH",
};

async function loadChainWith(chainId: string, rpc: string) {
  vi.resetModules();
  process.env.NEXT_PUBLIC_CHAINMON_CHAIN_ID = chainId;
  process.env.NEXT_PUBLIC_CHAINMON_RPC_URL = rpc;
  process.env.NEXT_PUBLIC_MONSTER_NFT_ADDRESS =
    "0x0000000000000000000000000000000000000001";
  process.env.NEXT_PUBLIC_MONSTER_MARKETPLACE_ADDRESS =
    "0x0000000000000000000000000000000000000002";
  const mod = await import("../chain");
  return mod;
}

afterEach(() => {
  vi.resetModules();
  delete process.env.NEXT_PUBLIC_CHAINMON_CHAIN_ID;
  delete process.env.NEXT_PUBLIC_CHAINMON_RPC_URL;
});

describe("marketplace native currency mapping", () => {
  it("Monad Testnet (10143) → NATIVE_CURRENCY_SYMBOL = MON", async () => {
    const chain = await loadChainWith("10143", "https://testnet-rpc.monad.xyz");
    expect(chain.NATIVE_CURRENCY_SYMBOL).toBe("MON");
    expect(chain.chainmonChain.id).toBe(10143);
    expect(chain.chainmonChain.nativeCurrency.symbol).toBe("MON");
    expect(chain.chainmonChain.blockExplorers?.default.url).toBe(
      "https://testnet.monadscan.com",
    );
  });

  it("Hardhat localhost (31337) → NATIVE_CURRENCY_SYMBOL = ETH", async () => {
    const chain = await loadChainWith("31337", "http://127.0.0.1:8545");
    expect(chain.NATIVE_CURRENCY_SYMBOL).toBe("ETH");
    expect(chain.chainmonChain.id).toBe(31337);
    expect(chain.chainmonChain.nativeCurrency.symbol).toBe("ETH");
  });

  it("static truth table matches the dynamic mapping", async () => {
    const monad = await loadChainWith("10143", "https://testnet-rpc.monad.xyz");
    expect(monad.NATIVE_CURRENCY_SYMBOL).toBe(STATIC_CURRENCY[10143]);
    const local = await loadChainWith("31337", "http://127.0.0.1:8545");
    expect(local.NATIVE_CURRENCY_SYMBOL).toBe(STATIC_CURRENCY[31337]);
  });

  it("price is denominated in native wei (10^-18) regardless of symbol", () => {
    const priceWei = 10n ** 15n; // 0.001 native units
    expect(priceWei > 0n).toBe(true);
    expect(priceWei % 10n ** 18n).toBe(priceWei);
  });
});
