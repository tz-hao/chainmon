import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Abi,
} from "viem";
import { prisma } from "@/lib/prisma";
import { prismaRepository } from "../prisma-repository";
import { createTrainerWithStarter } from "../demo-service";
import { hashGameMonsterId, hashMonsterDNA } from "../../web3/hash";
import { ViemChainGateway } from "../../web3/server-client";
import { chainmonChain, MONSTER_MARKETPLACE_ADDRESS } from "../../web3/chain";
import monsterNftAbi from "../../../../../contracts/abis/MonsterNFT.json";
import monsterMarketplaceAbi from "../../../../../contracts/abis/MonsterMarketplace.json";
import { listMonster } from "../../services/marketplace-service";

/**
 * RESTART PERSISTENCE setup (Phase 9, section 26).
 *
 * Creates real data in real PostgreSQL + the real local blockchain:
 *   Trainer → Starter → Mint NFT (real tx) → Active Listing (real tx)
 *
 * Run before starting the web server:
 *   RUN_DB_PERSISTENCE=1 RUN_CHAIN_INTEGRATION=1 \
 *   CHAINMON_RPC_URL=... CHAINMON_MONSTER_NFT_ADDRESS=... \
 *   CHAINMON_MONSTER_MARKETPLACE_ADDRESS=... CHAINMON_MINTER_PRIVATE_KEY=... \
 *   npx vitest run apps/web/lib/data/__tests__/persistence-setup.test.ts
 *
 * Then start/restart the web server and run persistence-verify.test.ts.
 */

const RUN = process.env.RUN_DB_PERSISTENCE === "1";

const WALLET_A = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const WALLET_B = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
);

const PRICE_WEI = 10000000000000000n; // 0.01 ETH

describe.skipIf(!RUN)("persistence setup (real DB + real chain)", () => {
  it("creates trainer, captures, mints NFT and lists it — persists across restarts", async () => {
    // Fresh business state.
    await prisma.marketplaceListing.deleteMany();
    await prisma.onchainEvolution.deleteMany();
    await prisma.monsterEvolution.deleteMany();
    await prisma.battleMonster.deleteMany();
    await prisma.battle.deleteMany();
    await prisma.teamSlot.deleteMany();
    await prisma.encounter.deleteMany();
    await prisma.inventory.deleteMany();
    await prisma.monster.deleteMany();
    await prisma.trainer.deleteMany();
    await prisma.user.deleteMany();

    const gateway = new ViemChainGateway();
    const nft = gateway.contractAddress;
    const marketplace = MONSTER_MARKETPLACE_ADDRESS;
    const nftAbi = monsterNftAbi.abi as Abi;
    const mpAbi = monsterMarketplaceAbi.abi as Abi;

    // 1) Trainer + starter.
    const { trainer, monster } = await createTrainerWithStarter(
      prismaRepository,
      "PersistTrainer",
      "firecub",
    );
    await prismaRepository.bindWallet(trainer.id, WALLET_A.address);

    // 2) Real mint of the starter monster to wallet A.
    const payload = {
      gameMonsterIdHash: hashGameMonsterId(monster.id),
      speciesId: monster.speciesId,
      generation: monster.generation,
      rarity: 0,
      evolutionStage: 0,
      dnaHash: hashMonsterDNA(monster.dna),
    };
    const mintTx = await gateway.mintMonster(WALLET_A.address, payload);
    const mintReceipt = await gateway.waitForTransactionReceipt(mintTx, 30000);
    expect(mintReceipt?.status).toBe("success");
    const tokenId = await gateway.getTokenIdByGameMonsterId(
      payload.gameMonsterIdHash,
    );
    await prismaRepository.setMintConfirmed(
      monster.id,
      tokenId.toString(),
      WALLET_A.address.toLowerCase(),
    );

    // 3) Real approve + list by the user wallet.
    const seller = createWalletClient({
      account: WALLET_A,
      chain: chainmonChain,
      transport: http(),
    });
    const publicClient = createPublicClient({
      chain: chainmonChain,
      transport: http(),
    });
    const approveTx = await seller.writeContract({
      address: nft,
      abi: nftAbi,
      chain: chainmonChain,
      account: WALLET_A.address,
      functionName: "approve",
      args: [marketplace, tokenId],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
    const listTx = await seller.writeContract({
      address: marketplace,
      abi: mpAbi,
      chain: chainmonChain,
      account: WALLET_A.address,
      functionName: "listMonster",
      args: [tokenId, PRICE_WEI],
    });
    await publicClient.waitForTransactionReceipt({ hash: listTx });

    // 4) Confirm the listing through the service (DB + chain reconciled).
    const listing = await listMonster(
      prismaRepository,
      gateway,
      trainer.id,
      monster.id,
      listTx,
      PRICE_WEI.toString(),
    );
    expect(listing.status).toBe("ACTIVE");

    // 5) Second trainer B (buyer) for the marketplace flow.
    const userB = await prisma.user.create({
      data: { walletAddress: WALLET_B.address.toLowerCase() },
    });
    await prisma.trainer.create({
      data: { userId: userB.id, nickname: "PersistBuyer" },
    });

    // Log the stable ids — verified after a server restart.
    console.log("PERSISTENCE-SETUP-OK", JSON.stringify({
      trainerId: trainer.id,
      monsterId: monster.id,
      tokenId: tokenId.toString(),
      listingId: listing.id,
      priceWei: PRICE_WEI.toString(),
    }));
    expect(monster.id).toBeTruthy();
  });
});
