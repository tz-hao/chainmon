/**
 * ChainMon — environment validation (Phase 9, sections 64–66).
 *
 * Fail-fast startup check: verifies that every required environment variable
 * exists and that contract addresses / the backend wallet are valid
 * checksummed addresses. Optionally verifies the RPC chain id against
 * CHAINMON_CHAIN_ID when --check-rpc is passed.
 *
 * Run:
 *   npx tsx scripts/validate-env.ts            (structure only)
 *   npx tsx scripts/validate-env.ts --check-rpc (also queries the RPC)
 *
 * Never prints secret values.
 */

import { createPublicClient, getAddress, http, isAddress } from "viem";
import { defineChain } from "viem";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    console.error(`[validate-env] MISSING ${name}`);
    return "";
  }
  return value.trim();
}

function main() {
  let ok = true;

  const required = [
    "DATABASE_URL",
    "CHAINMON_CHAIN_ID",
    "CHAINMON_RPC_URL",
    "CHAINMON_MONSTER_NFT_ADDRESS",
    "CHAINMON_MONSTER_MARKETPLACE_ADDRESS",
    "CHAINMON_MINTER_PRIVATE_KEY",
    "NEXT_PUBLIC_CHAINMON_CHAIN_ID",
    "NEXT_PUBLIC_CHAINMON_RPC_URL",
    "NEXT_PUBLIC_MONSTER_NFT_ADDRESS",
    "NEXT_PUBLIC_MONSTER_MARKETPLACE_ADDRESS",
  ];

  const values: Record<string, string> = {};
  for (const name of required) {
    const value = requireEnv(name);
    values[name] = value;
    if (!value) ok = false;
  }

  // Address validation (contracts + public mirrors).
  const addressVars = [
    "CHAINMON_MONSTER_NFT_ADDRESS",
    "CHAINMON_MONSTER_MARKETPLACE_ADDRESS",
    "NEXT_PUBLIC_MONSTER_NFT_ADDRESS",
    "NEXT_PUBLIC_MONSTER_MARKETPLACE_ADDRESS",
  ];
  for (const name of addressVars) {
    const value = values[name];
    if (value && !isAddress(value)) {
      console.error(`[validate-env] INVALID address in ${name}: ${value}`);
      ok = false;
    } else if (value) {
      try {
        getAddress(value); // checksum sanity
      } catch {
        console.error(`[validate-env] BAD CHECKSUM in ${name}: ${value}`);
        ok = false;
      }
    }
  }

  // Private key format (hex 64, with or without 0x prefix) — never print.
  const key = values["CHAINMON_MINTER_PRIVATE_KEY"];
  const normalizedKey = key && !key.startsWith("0x") ? `0x${key}` : key;
  if (normalizedKey && !/^0x[0-9a-fA-F]{64}$/.test(normalizedKey)) {
    console.error("[validate-env] CHAINMON_MINTER_PRIVATE_KEY has invalid format");
    ok = false;
  }

  // Chain id consistency (env vs NEXT_PUBLIC).
  const chainId = values["CHAINMON_CHAIN_ID"];
  const publicChainId = values["NEXT_PUBLIC_CHAINMON_CHAIN_ID"];
  if (chainId && publicChainId && chainId !== publicChainId) {
    console.error(
      `[validate-env] MISMATCH CHAINMON_CHAIN_ID=${chainId} vs NEXT_PUBLIC_CHAINMON_CHAIN_ID=${publicChainId}`,
    );
    ok = false;
  }

  // RPC URL format sanity.
  const rpc = values["CHAINMON_RPC_URL"];
  if (rpc && !/^https?:\/\//.test(rpc)) {
    console.error(`[validate-env] CHAINMON_RPC_URL must be http(s): ${rpc}`);
    ok = false;
  }

  // Monad Testnet awareness: when targeting chainId 10143 the RPC must be a
  // Monad endpoint and the explorer should point at Monadscan (best effort).
  if (chainId === "10143") {
    const monadRpc = process.env.MONAD_TESTNET_RPC_URL;
    if (monadRpc && monadRpc !== rpc) {
      console.error(
        "[validate-env] MISMATCH CHAINMON_RPC_URL vs MONAD_TESTNET_RPC_URL (Monad target)",
      );
      ok = false;
    }
    const explorer = process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL ?? "";
    if (explorer && !explorer.includes("monadscan")) {
      console.error(
        "[validate-env] NEXT_PUBLIC_BLOCK_EXPLORER_URL should be Monadscan for Monad Testnet",
      );
      ok = false;
    }
  }

  if (!ok) {
    console.error("[validate-env] FAILED — fix the variables above.");
    process.exitCode = 1;
    return;
  }
  console.log("[validate-env] OK (structure)");
}

async function checkRpc() {
  const chainId = Number(process.env.CHAINMON_CHAIN_ID ?? 31337);
  const rpcUrl = process.env.CHAINMON_RPC_URL ?? "http://127.0.0.1:8545";
  const isMonad = chainId === 10143;
  const chain = defineChain({
    id: chainId,
    name: isMonad ? "Monad Testnet" : "ChainMon",
    nativeCurrency: isMonad
      ? { name: "MON", symbol: "MON", decimals: 18 }
      : { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  try {
    const client = createPublicClient({ chain, transport: http() });
    const actual = await client.getChainId();
    if (actual !== chainId) {
      console.error(
        `[validate-env] RPC chainId mismatch: configured=${chainId} actual=${actual} — deployment STOPPED`,
      );
      process.exitCode = 1;
    } else {
      console.log(`[validate-env] RPC OK — chainId ${actual} matches config.`);
    }
  } catch (error) {
    console.error(
      `[validate-env] RPC unreachable: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

if (process.argv.includes("--check-rpc")) {
  main();
  if (process.exitCode !== 1) {
    checkRpc().then(() => {
      // done
    });
  }
} else {
  main();
}
