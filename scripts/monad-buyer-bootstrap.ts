/**
 * One-time Monad testnet buyer-wallet bootstrap (testnet-only, dev fixture):
 *  - generates a random test-only buyer key (never printed),
 *  - saves it to contracts/.env as MONAD_TESTNET_BUYER_PRIVATE_KEY (gitignored),
 *  - prints the buyer ADDRESS and funds it with a small amount of test MON
 *    from the deployer wallet (real testnet tx).
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import * as path from "path";
import { createPublicClient, http, parseEther, type Hex } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { defineChain } from "viem";

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
const CHAIN_ID = 10143;
const FUND_AMOUNT = process.env.MONAD_BUYER_FUND_MON || "1"; // 1 test MON

const chain = defineChain({
  id: CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

async function main() {
  const publicClient = createPublicClient({ chain, transport: http() });
  const rpcChainId = await publicClient.getChainId();
  if (rpcChainId !== CHAIN_ID) throw new Error(`wrong chain: ${rpcChainId}`);

  const deployerKey = process.env.MONAD_DEPLOYER_PRIVATE_KEY;
  const normalized = deployerKey && !deployerKey.startsWith("0x") ? `0x${deployerKey}` : deployerKey;
  if (!normalized || !/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("MONAD_DEPLOYER_PRIVATE_KEY missing/invalid");
  }
  const deployer = privateKeyToAccount(normalized as `0x${string}`);

  const existingBuyerKey = process.env.MONAD_TESTNET_BUYER_PRIVATE_KEY;
  const buyerKey = existingBuyerKey
    ? (existingBuyerKey.startsWith("0x") ? existingBuyerKey : `0x${existingBuyerKey}`)
    : generatePrivateKey();
  const buyer = privateKeyToAccount(buyerKey as `0x${string}`);
  console.log("Buyer address:", buyer.address);

  // Persist the buyer key into contracts/.env (gitignored) if not already there.
  const envFile = path.join(__dirname, "..", "contracts", ".env");
  const raw = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
  if (!/^\s*MONAD_TESTNET_BUYER_PRIVATE_KEY\s*=/m.test(raw)) {
    writeFileSync(envFile, raw.trimEnd() + `\nMONAD_TESTNET_BUYER_PRIVATE_KEY=${buyerKey.replace(/^0x/, "")}\n`, "utf8");
    console.log("Buyer key saved to contracts/.env (not printed).");
  }

  const buyerBalance = await publicClient.getBalance({ address: buyer.address });
  console.log("Buyer current balance:", Number(buyerBalance) / 1e18, "MON");
  if (buyerBalance > 0n) {
    console.log("Buyer already funded — no transfer needed.");
    return;
  }

  // Monad public RPC rejects eth_sendTransaction — sign locally and send raw.
  const nonce = await publicClient.getTransactionCount({ address: deployer.address });
  const gasPrice = await publicClient.getGasPrice();
  const tx = await deployer.signTransaction({
    chain,
    to: buyer.address,
    value: parseEther(FUND_AMOUNT),
    nonce,
    gas: 21000n,
    gasPrice,
  });
  const rawHash = await publicClient.sendRawTransaction({ serializedTransaction: tx as Hex });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: rawHash, timeout: 120_000 });
  console.log("Fund tx:", rawHash, "status:", receipt.status);
  if (receipt.status !== "success") throw new Error("funding failed");
  const after = await publicClient.getBalance({ address: buyer.address });
  console.log("Buyer balance after funding:", Number(after) / 1e18, "MON");
  console.log("BUYER-BOOTSTRAP-OK");
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exitCode = 1;
});
