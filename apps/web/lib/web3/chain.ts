/**
 * ChainMon chain configuration (Phase 7 / Monad Final Deployment).
 * Client-safe values use NEXT_PUBLIC_*; the minter private key stays
 * server-only and is NEVER exposed here.
 *
 * Supported networks:
 *  - Monad Testnet   (chainId 10143, MON) — primary public testnet target
 *  - Hardhat localhost (chainId 31337, ETH) — development / CI
 *
 * The chain definition is built from the configured chain id, so any
 * EVM-compatible target works; the native currency symbol follows the
 * configured chain (marketplace UI displays it dynamically).
 */

import { defineChain } from "viem";

export const CHAINMON_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_CHAINMON_CHAIN_ID ??
    process.env.CHAINMON_CHAIN_ID ??
    10143,
);

export const CHAINMON_RPC_URL =
  process.env.CHAINMON_RPC_URL ??
  process.env.NEXT_PUBLIC_CHAINMON_RPC_URL ??
  "https://testnet-rpc.monad.xyz";

export const MONSTER_NFT_ADDRESS = (
  process.env.NEXT_PUBLIC_MONSTER_NFT_ADDRESS ??
  process.env.CHAINMON_MONSTER_NFT_ADDRESS ??
  ""
) as `0x${string}`;

export const MONSTER_MARKETPLACE_ADDRESS = (
  process.env.NEXT_PUBLIC_MONSTER_MARKETPLACE_ADDRESS ??
  process.env.CHAINMON_MONSTER_MARKETPLACE_ADDRESS ??
  ""
) as `0x${string}`;

export const BLOCK_EXPLORER_URL =
  process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL ?? "";

/** Monad Testnet — official public parameters (chainId 10143, MON). */
export const MONAD_TESTNET = {
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "Monadscan", url: "https://testnet.monadscan.com" },
  },
  testnet: true,
} as const;

/** ChainMon target chain — built from configuration, Monad-aware. */
export const chainmonChain = defineChain({
  id: CHAINMON_CHAIN_ID,
  name: CHAINMON_CHAIN_ID === MONAD_TESTNET.id ? "Monad Testnet" : "ChainMon Network",
  nativeCurrency:
    CHAINMON_CHAIN_ID === MONAD_TESTNET.id
      ? MONAD_TESTNET.nativeCurrency
      : { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [CHAINMON_RPC_URL] },
  },
  blockExplorers: CHAINMON_CHAIN_ID === MONAD_TESTNET.id
    ? MONAD_TESTNET.blockExplorers
    : undefined,
  testnet: CHAINMON_CHAIN_ID === MONAD_TESTNET.id,
});

/**
 * Native marketplace currency symbol (never hardcode ETH): follows the
 * configured chain — Monad Testnet → MON, Hardhat localhost → ETH.
 */
export const NATIVE_CURRENCY_SYMBOL = chainmonChain.nativeCurrency.symbol;
export const NATIVE_CURRENCY_NAME = chainmonChain.nativeCurrency.name;
