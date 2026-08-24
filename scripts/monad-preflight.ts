/**
 * Monad Testnet pre-flight check (Final Deployment, sections 13–17):
 * verifies RPC chainId, deployer address (from key), MON balance and
 * faucet guidance WITHOUT deploying anything. Never prints private keys.
 *
 * Run:
 *   npx tsx scripts/monad-preflight.ts
 *
 * Requires MONAD_DEPLOYER_PRIVATE_KEY (env or contracts/.env) and
 * MONAD_TESTNET_RPC_URL (defaults to https://testnet-rpc.monad.xyz).
 */

import { readFileSync, existsSync } from "fs";
import * as path from "path";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";

// Load contracts/.env manually (dotenv not installed at root).
function loadContractEnv() {
  const file = path.join(__dirname, "..", "contracts", ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2]!.replace(/^["']|["']$/g, "");
    }
  }
}

loadContractEnv();

const RPC = process.env.MONAD_TESTNET_RPC_URL || "https://testnet-rpc.monad.xyz";
const KEY = process.env.MONAD_DEPLOYER_PRIVATE_KEY;
const CHAIN_ID = 10143;

async function main() {
  const chain = defineChain({
    id: CHAIN_ID,
    name: "Monad Testnet",
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: { default: { http: [RPC] } },
  });
  const client = createPublicClient({ chain, transport: http() });

  // 1. RPC chain id — never trust env alone.
  const actual = await client.getChainId();
  console.log(`RPC chainId: ${actual} (expected ${CHAIN_ID})`);
  if (actual !== CHAIN_ID) {
    console.error("ABORT: RPC chainId mismatch — refusing to deploy.");
    process.exitCode = 1;
    return;
  }
  const block = await client.getBlockNumber();
  console.log(`Latest block: ${block}`);

  // 2. Deployer address from the key (never print the key).
  // Accept with or without the 0x prefix (64 hex chars).
  const normalizedKey = KEY && !KEY.startsWith("0x") ? `0x${KEY}` : KEY;
  if (!normalizedKey || !/^0x[0-9a-fA-F]{64}$/.test(normalizedKey)) {
    console.error(
      "ABORT: MONAD_DEPLOYER_PRIVATE_KEY missing/invalid — add it to contracts/.env.",
    );
    console.error("Monad Testnet faucet required before deployment (test MON).");
    process.exitCode = 1;
    return;
  }
  const deployer = privateKeyToAccount(normalizedKey as `0x${string}`);
  console.log(`Deployer address: ${deployer.address}`);

  // 3. MON balance.
  const balance = await client.getBalance({ address: deployer.address });
  const balMon = Number(balance) / 1e18;
  console.log(`Deployer MON balance: ${balMon.toFixed(6)} MON (${balance} wei)`);
  if (balance === 0n) {
    console.error(
      "Insufficient Monad Testnet MON for deployment. " +
        "Monad Testnet faucet required (test MON, not mainnet purchase).",
    );
    process.exitCode = 1;
    return;
  }
  console.log("PREFLIGHT OK — ready to deploy (contracts:deploy:monad).");
}

main().catch((error) => {
  console.error(
    `Preflight failed (RPC unreachable or error): ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
