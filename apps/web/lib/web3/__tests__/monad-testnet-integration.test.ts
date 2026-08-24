import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import * as path from "path";
import { privateKeyToAccount } from "viem/accounts";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  type Abi,
} from "viem";
import { chainmonChain } from "../chain";
import monsterNftAbi from "../../../../../contracts/abis/MonsterNFT.json";
import monsterMarketplaceAbi from "../../../../../contracts/abis/MonsterMarketplace.json";
import { hashGameMonsterId, hashMonsterDNA } from "../hash";
import { ViemChainGateway } from "../server-client";

/**
 * REAL Monad Testnet integration tests (Final Monad Deployment).
 *
 * Uses the already-deployed contracts from deployments/monadTestnet.json —
 * never deploys new contracts per test (saves test MON).
 *
 * Run only when explicitly enabled (real Monad credentials + funded wallets):
 *   RUN_MONAD_TESTNET_INTEGRATION=1 \
 *   MONAD_TESTNET_RPC_URL=... MONAD_DEPLOYER_PRIVATE_KEY=... \
 *   MONAD_TESTNET_BUYER_PRIVATE_KEY=... \
 *   npx vitest run apps/web/lib/web3/__tests__/monad-testnet-integration.test.ts
 *
 * Skipped by default (no testnet credentials in CI/dev).
 * WARNING: performs REAL on-chain transactions on Monad Testnet (test MON).
 */

const RUN = process.env.RUN_MONAD_TESTNET_INTEGRATION === "1";

/** Normalize a private key (with or without 0x prefix) without printing it. */
function normalizeKey(raw: string | undefined): `0x${string}` | null {
  if (!raw) return null;
  const key = raw.startsWith("0x") ? raw : `0x${raw}`;
  return /^0x[0-9a-fA-F]{64}$/.test(key) ? (key as `0x${string}`) : null;
}

function readDeployment() {
  const file = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "..",
    "contracts",
    "deployments",
    "monadTestnet.json",
  );
  return JSON.parse(readFileSync(file, "utf8")) as {
    chainId: number;
    MonsterNFT: string;
    MonsterMarketplace: string;
  };
}

// Monad public RPC can be slow — give every test generous timeouts.
const MONAD_TIMEOUT = 120_000;

describe.skipIf(!RUN)("real Monad Testnet integration (chainId 10143)", () => {
  it(
    "RPC chainId, deployed code, versions and roles are correct",
    { timeout: MONAD_TIMEOUT },
    async () => {
    const record = readDeployment();
    const publicClient = createPublicClient({
      chain: chainmonChain,
      transport: http(),
    });
    // RPC chain id must be 10143 — never trust env alone.
    const rpcChainId = await publicClient.getChainId();
    expect(rpcChainId).toBe(10143);

    const nftCode = await publicClient.getCode({
      address: getAddress(record.MonsterNFT),
    });
    const mpCode = await publicClient.getCode({
      address: getAddress(record.MonsterMarketplace),
    });
    expect(nftCode).not.toBe("0x");
    expect(mpCode).not.toBe("0x");

    const nftVersion = (await publicClient.readContract({
      address: getAddress(record.MonsterNFT),
      abi: monsterNftAbi.abi as Abi,
      functionName: "CONTRACT_VERSION",
    })) as string;
    const mpVersion = (await publicClient.readContract({
      address: getAddress(record.MonsterMarketplace),
      abi: monsterMarketplaceAbi.abi as Abi,
      functionName: "CONTRACT_VERSION",
    })) as string;
    expect(nftVersion).toBe("1.0.0");
    expect(mpVersion).toBe("1.0.0");

    // Marketplace wiring.
    const wired = (await publicClient.readContract({
      address: getAddress(record.MonsterMarketplace),
      abi: monsterMarketplaceAbi.abi as Abi,
      functionName: "monsterNFT",
    })) as `0x${string}`;
    expect(getAddress(wired)).toBe(getAddress(record.MonsterNFT));
  });

  it(
    "mints a unique monster, reads it back and verifies DNA (real tx)",
    { timeout: MONAD_TIMEOUT },
    async () => {
      const record = readDeployment();
      const key = normalizeKey(process.env.MONAD_DEPLOYER_PRIVATE_KEY);
      if (!key) throw new Error("MONAD_DEPLOYER_PRIVATE_KEY is required.");
      const operator = privateKeyToAccount(key);
      const gateway = new ViemChainGateway();

      const monsterId = `monad-test-${Date.now()}`;
      const dna = {
        hpGene: 7,
        attackGene: 8,
        defenseGene: 9,
        speedGene: 10,
        mutationGene: 11,
      };
      const payload = {
        gameMonsterIdHash: hashGameMonsterId(monsterId),
        speciesId: 1, // FireCub
        generation: 1,
        rarity: 0,
        evolutionStage: 0,
        dnaHash: hashMonsterDNA(dna),
      };

      const txHash = await gateway.mintMonster(operator.address, payload);
      const receipt = await gateway.waitForTransactionReceipt(txHash, 120000);
      expect(receipt?.status).toBe("success");

      const tokenId = await gateway.getTokenIdByGameMonsterId(
        payload.gameMonsterIdHash,
      );
      expect(tokenId).toBeGreaterThan(0n);

      const owner = await gateway.getOwner(tokenId);
      expect(getAddress(owner)).toBe(getAddress(operator.address));

      const data = await gateway.getMonster(tokenId);
      expect(data.dnaHash).toBe(payload.dnaHash);
      expect(data.gameMonsterIdHash).toBe(payload.gameMonsterIdHash);
      expect(Number(data.speciesId)).toBe(1);
      expect(Number(data.generation)).toBe(1);
      expect(Number(data.rarity)).toBe(0);
      expect(Number(data.evolutionStage)).toBe(0);

      // Duplicate mint must revert on the real chain.
      await expect(gateway.mintMonster(operator.address, payload)).rejects.toThrow();
    },
  );

  it(
    "full marketplace flow with two wallets (approve → list → buy → settlement)",
    { timeout: MONAD_TIMEOUT },
    async () => {
      const record = readDeployment();
      const key = normalizeKey(process.env.MONAD_DEPLOYER_PRIVATE_KEY);
      const buyerKey = normalizeKey(process.env.MONAD_TESTNET_BUYER_PRIVATE_KEY);
      if (!key || !buyerKey) {
        throw new Error(
          "MONAD_DEPLOYER_PRIVATE_KEY and MONAD_TESTNET_BUYER_PRIVATE_KEY are required.",
        );
      }
      const seller = privateKeyToAccount(key);
      const buyer = privateKeyToAccount(buyerKey);
    const gateway = new ViemChainGateway();
    const marketplace = getAddress(record.MonsterMarketplace);
    const nftAbi = monsterNftAbi.abi as Abi;
    const mpAbi = monsterMarketplaceAbi.abi as Abi;
    const publicClient = createPublicClient({
      chain: chainmonChain,
      transport: http(),
    });

    // Fresh monster owned by the seller.
    const monsterId = `monad-sale-${Date.now()}`;
    const payload = {
      gameMonsterIdHash: hashGameMonsterId(monsterId),
      speciesId: 3, // LeafCat
      generation: 1,
      rarity: 1,
      evolutionStage: 0,
      dnaHash: hashMonsterDNA({
        hpGene: 21,
        attackGene: 22,
        defenseGene: 23,
        speedGene: 24,
        mutationGene: 25,
      }),
    };
    const mintTx = await gateway.mintMonster(seller.address, payload);
    await gateway.waitForTransactionReceipt(mintTx, 120000);
    const tokenId = await gateway.getTokenIdByGameMonsterId(
      payload.gameMonsterIdHash,
    );

    // Approve (seller wallet tx — client account signs locally).
    const sellerClient = createWalletClient({
      account: seller,
      chain: chainmonChain,
      transport: http(),
    });
    const approveTx = await sellerClient.writeContract({
      address: getAddress(record.MonsterNFT),
      abi: nftAbi,
      chain: chainmonChain,
      functionName: "approve",
      args: [marketplace, tokenId],
    });
    const approveReceipt = await publicClient.waitForTransactionReceipt({
      hash: approveTx,
    });
    expect(approveReceipt.status).toBe("success");

    // List at a small price (0.001 MON).
    const price = 1000000000000000n; // 0.001 * 10^18
    const listTx = await sellerClient.writeContract({
      address: marketplace,
      abi: mpAbi,
      chain: chainmonChain,
      functionName: "listMonster",
      args: [tokenId, price],
    });
    await publicClient.waitForTransactionReceipt({ hash: listTx });
    const listing = await gateway.getMarketplaceListing(tokenId);
    expect(listing.active).toBe(true);
    expect(listing.price).toBe(price);
    expect(getAddress(listing.seller)).toBe(getAddress(seller.address));

    // Buy (buyer wallet tx) with exact MON value.
    const buyerClient = createWalletClient({
      account: buyer,
      chain: chainmonChain,
      transport: http(),
    });
    const buyTx = await buyerClient.writeContract({
      address: marketplace,
      abi: mpAbi,
      chain: chainmonChain,
      functionName: "buyMonster",
      args: [tokenId],
      value: price,
    });
    await publicClient.waitForTransactionReceipt({ hash: buyTx });

    // Acceptance: ownership moved, listing inactive, marketplace holds 0 MON.
    const owner = await gateway.getOwner(tokenId);
    expect(getAddress(owner)).toBe(getAddress(buyer.address));
    const after = await gateway.getMarketplaceListing(tokenId);
    expect(after.active).toBe(false);
    const mpBalance = await publicClient.getBalance({ address: marketplace });
    expect(mpBalance).toBe(0n);

    console.log(
      `MONAD-MARKETPLACE-OK token=${tokenId} seller=${seller.address} buyer=${buyer.address} priceWei=${price}`,
    );
  });
});
