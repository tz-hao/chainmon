import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  type Abi,
} from "viem";
import { ViemChainGateway } from "../server-client";
import { hashGameMonsterId, hashMonsterDNA } from "../hash";
import { chainmonChain, MONSTER_MARKETPLACE_ADDRESS } from "../chain";
import monsterNftAbi from "../../../../../contracts/abis/MonsterNFT.json";
import monsterMarketplaceAbi from "../../../../../contracts/abis/MonsterMarketplace.json";

/**
 * REAL-chain marketplace integration tests against a persistent Hardhat
 * localhost node (http://127.0.0.1:8545, chainId 31337).
 *
 * Run only when explicitly enabled:
 *   RUN_CHAIN_INTEGRATION=1 CHAINMON_RPC_URL=http://127.0.0.1:8545 \
 *   CHAINMON_MONSTER_NFT_ADDRESS=0x... CHAINMON_MONSTER_MARKETPLACE_ADDRESS=0x... \
 *   CHAINMON_MINTER_PRIVATE_KEY=0x... \
 *   npx vitest run apps/web/lib/web3/__tests__/chain-marketplace-integration.test.ts
 *
 * These are skipped by default (no RPC dependency in CI/dev).
 */

const RUN = process.env.RUN_CHAIN_INTEGRATION === "1";

// Hardhat deterministic test accounts (NOT secrets — public dev wallets).
const SELLER_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // account #1
const BUYER_KEY =
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"; // account #2

const PRICE_WEI = 10000000000000000n; // 0.01 ETH

function makeUserClients(key: `0x${string}`) {
  const account = privateKeyToAccount(key);
  const publicClient = createPublicClient({
    chain: chainmonChain,
    transport: http(),
  });
  const walletClient = createWalletClient({
    account,
    chain: chainmonChain,
    transport: http(),
  });
  return { account, publicClient, walletClient };
}

describe.skipIf(!RUN)("real-chain marketplace integration (localhost)", () => {
  it("mint → approve → list → buy: NFT transfers, ETH settles to seller, no escrow", async () => {
    const gateway = new ViemChainGateway();
    const nft = gateway.contractAddress;
    const marketplace = MONSTER_MARKETPLACE_ADDRESS
      ? getAddress(MONSTER_MARKETPLACE_ADDRESS)
      : gateway.marketplaceAddress;
    const nftAbi = monsterNftAbi.abi as Abi;
    const mpAbi = monsterMarketplaceAbi.abi as Abi;

    const seller = makeUserClients(SELLER_KEY);
    const buyer = makeUserClients(BUYER_KEY);

    // 1) Backend mints a fresh monster to the seller's wallet.
    const dna = {
      hpGene: 11,
      attackGene: 22,
      defenseGene: 33,
      speedGene: 44,
      mutationGene: 55,
    };
    const gameMonsterId = `marketplace-integration-${Date.now()}`;
    const payload = {
      gameMonsterIdHash: hashGameMonsterId(gameMonsterId),
      speciesId: 3, // LeafCat (any species works)
      generation: 1,
      rarity: 1,
      evolutionStage: 0,
      dnaHash: hashMonsterDNA(dna),
    };
    const mintTx = await gateway.mintMonster(seller.account.address, payload);
    const mintReceipt = await gateway.waitForTransactionReceipt(mintTx, 30000);
    expect(mintReceipt?.status).toBe("success");
    const tokenId = await gateway.getTokenIdByGameMonsterId(
      payload.gameMonsterIdHash,
    );
    expect(tokenId).toBeGreaterThan(0n);

    // 2) Seller approves the marketplace for the token.
    const approveTx = await seller.walletClient.writeContract({
      address: nft,
      abi: nftAbi,
      chain: chainmonChain,
      account: seller.account.address,
      functionName: "approve",
      args: [marketplace, tokenId],
    });
    await seller.publicClient.waitForTransactionReceipt({ hash: approveTx });
    expect(
      await gateway.isNftApprovedForMarketplace(seller.account.address, tokenId),
    ).toBe(true);

    // 3) Seller lists the monster at a fixed price.
    const sellerBalanceBefore = await seller.publicClient.getBalance({
      address: seller.account.address,
    });
    const listTx = await seller.walletClient.writeContract({
      address: marketplace,
      abi: mpAbi,
      chain: chainmonChain,
      account: seller.account.address,
      functionName: "listMonster",
      args: [tokenId, PRICE_WEI],
    });
    await seller.publicClient.waitForTransactionReceipt({ hash: listTx });

    const listing = await gateway.getMarketplaceListing(tokenId);
    expect(listing.active).toBe(true);
    expect(listing.seller.toLowerCase()).toBe(
      seller.account.address.toLowerCase(),
    );
    expect(listing.price).toBe(PRICE_WEI);
    expect(await gateway.getMarketplaceVersion()).toBe("1.0.0");

    // 4) Buyer buys — exact ETH payment.
    const buyerBalanceBefore = await buyer.publicClient.getBalance({
      address: buyer.account.address,
    });
    const buyTx = await buyer.walletClient.writeContract({
      address: marketplace,
      abi: mpAbi,
      chain: chainmonChain,
      account: buyer.account.address,
      functionName: "buyMonster",
      args: [tokenId],
      value: PRICE_WEI,
    });
    const buyReceipt = await buyer.publicClient.waitForTransactionReceipt({
      hash: buyTx,
    });
    expect(buyReceipt.status).toBe("success");

    // 5) Ownership moved to the buyer.
    expect((await gateway.getOwner(tokenId)).toLowerCase()).toBe(
      buyer.account.address.toLowerCase(),
    );
    // Listing is no longer active.
    const after = await gateway.getMarketplaceListing(tokenId);
    expect(after.active).toBe(false);

    // 6) ETH settled directly seller ← buyer (non-custodial, 0% fee):
    //    marketplace retains zero balance.
    const mpBalance = await buyer.publicClient.getBalance({
      address: marketplace,
    });
    expect(mpBalance).toBe(0n);
    const sellerBalanceAfter = await seller.publicClient.getBalance({
      address: seller.account.address,
    });
    const buyerBalanceAfter = await buyer.publicClient.getBalance({
      address: buyer.account.address,
    });
    const gasEstimate = 200000n * 2000000000n; // conservative upper bound
    expect(sellerBalanceAfter - sellerBalanceBefore).toBeGreaterThanOrEqual(
      PRICE_WEI - gasEstimate,
    );
    expect(buyerBalanceBefore - buyerBalanceAfter).toBeGreaterThanOrEqual(
      PRICE_WEI,
    );

    // 7) Buyer can re-sell: approve again (transfer clears approval), then
    //    list and cancel (cancel path).
    const reapproveTx = await buyer.walletClient.writeContract({
      address: nft,
      abi: nftAbi,
      chain: chainmonChain,
      account: buyer.account.address,
      functionName: "approve",
      args: [marketplace, tokenId],
    });
    await buyer.publicClient.waitForTransactionReceipt({ hash: reapproveTx });
    const relistTx = await buyer.walletClient.writeContract({
      address: marketplace,
      abi: mpAbi,
      chain: chainmonChain,
      account: buyer.account.address,
      functionName: "listMonster",
      args: [tokenId, PRICE_WEI],
    });
    await buyer.publicClient.waitForTransactionReceipt({ hash: relistTx });
    const relisted = await gateway.getMarketplaceListing(tokenId);
    expect(relisted.active).toBe(true);
    const cancelTx = await buyer.walletClient.writeContract({
      address: marketplace,
      abi: mpAbi,
      chain: chainmonChain,
      account: buyer.account.address,
      functionName: "cancelListing",
      args: [tokenId],
    });
    await buyer.publicClient.waitForTransactionReceipt({ hash: cancelTx });
    const cancelled = await gateway.getMarketplaceListing(tokenId);
    expect(cancelled.active).toBe(false);
  });

  it("buy reverts on wrong payment amount (no state change)", async () => {
    const gateway = new ViemChainGateway();
    const nft = gateway.contractAddress;
    const marketplace = MONSTER_MARKETPLACE_ADDRESS
      ? getAddress(MONSTER_MARKETPLACE_ADDRESS)
      : gateway.marketplaceAddress;
    const nftAbi = monsterNftAbi.abi as Abi;
    const mpAbi = monsterMarketplaceAbi.abi as Abi;

    const seller = makeUserClients(SELLER_KEY);
    const buyer = makeUserClients(BUYER_KEY);

    const payload = {
      gameMonsterIdHash: hashGameMonsterId(
        `marketplace-wrongpay-${Date.now()}`,
      ),
      speciesId: 3,
      generation: 1,
      rarity: 0,
      evolutionStage: 0,
      dnaHash: hashMonsterDNA({
        hpGene: 1,
        attackGene: 2,
        defenseGene: 3,
        speedGene: 4,
        mutationGene: 5,
      }),
    };
    const mintTx = await gateway.mintMonster(seller.account.address, payload);
    await gateway.waitForTransactionReceipt(mintTx, 30000);
    const tokenId = await gateway.getTokenIdByGameMonsterId(
      payload.gameMonsterIdHash,
    );

    const approveTx = await seller.walletClient.writeContract({
      address: nft,
      abi: nftAbi,
      chain: chainmonChain,
      account: seller.account.address,
      functionName: "approve",
      args: [marketplace, tokenId],
    });
    await seller.publicClient.waitForTransactionReceipt({ hash: approveTx });

    const listTx = await seller.walletClient.writeContract({
      address: marketplace,
      abi: mpAbi,
      chain: chainmonChain,
      account: seller.account.address,
      functionName: "listMonster",
      args: [tokenId, PRICE_WEI],
    });
    await seller.publicClient.waitForTransactionReceipt({ hash: listTx });

    // Underpay → revert, NFT stays with seller, listing stays active.
    await expect(
      buyer.walletClient.writeContract({
        address: marketplace,
        abi: mpAbi,
        chain: chainmonChain,
        account: buyer.account.address,
        functionName: "buyMonster",
        args: [tokenId],
        value: PRICE_WEI - 1n,
      }),
    ).rejects.toThrow();

    expect((await gateway.getOwner(tokenId)).toLowerCase()).toBe(
      seller.account.address.toLowerCase(),
    );
    const listing = await gateway.getMarketplaceListing(tokenId);
    expect(listing.active).toBe(true);

    // Overpay → revert too (exact payment required).
    await expect(
      buyer.walletClient.writeContract({
        address: marketplace,
        abi: mpAbi,
        chain: chainmonChain,
        account: buyer.account.address,
        functionName: "buyMonster",
        args: [tokenId],
        value: PRICE_WEI + 1n,
      }),
    ).rejects.toThrow();
    expect((await gateway.getOwner(tokenId)).toLowerCase()).toBe(
      seller.account.address.toLowerCase(),
    );
  });
});
