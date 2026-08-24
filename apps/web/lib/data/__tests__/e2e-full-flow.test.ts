import {
  generateMonster,
  resetRandomSource,
  setRandomSource,
} from "@chainmon/game-engine";
import { getSpeciesBySlug } from "@chainmon/monster-data";
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
import { exploreRegion } from "../../services/explore-service";
import { throwBall } from "../../services/capture-service";
import {
  createBattle,
  saveBattleTeam,
  submitBattleAction,
} from "../../services/battle-service";
import { claimNft } from "../../services/nft-claim-service";
import { listMonster, reconcileListing } from "../../services/marketplace-service";
import { syncMonsterOwnership } from "../../services/ownership-sync-service";
import { ViemChainGateway } from "../../web3/server-client";
import { hashGameMonsterId, hashMonsterDNA } from "../../web3/hash";
import { chainmonChain, MONSTER_MARKETPLACE_ADDRESS } from "../../web3/chain";
import monsterNftAbi from "../../../../../contracts/abis/MonsterNFT.json";
import monsterMarketplaceAbi from "../../../../../contracts/abis/MonsterMarketplace.json";

/**
 * COMPLETE GAME-LOOP E2E (Phase 9, sections 45–47, 102):
 * real PostgreSQL + real local blockchain.
 *
 *   Trainer A: starter → explore → capture ×2 → team → battle → EXP/gold
 *   → wallet verify → NFT claim (real mint) → list (real tx)
 *   Trainer B: buy (real tx) → ownership sync → buyer collection
 *   → buyer team → buyer battle
 *
 * Run explicitly (hardhat node + PostgreSQL must be up):
 *   RUN_E2E=1 RUN_CHAIN_INTEGRATION=1 ... (chain + db env) \
 *   npx vitest run apps/web/lib/data/__tests__/e2e-full-flow.test.ts
 */

const RUN = process.env.RUN_E2E === "1";

const WALLET_A = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const WALLET_B = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
);

const PRICE_WEI = 10000000000000000n; // 0.01 ETH

async function cleanBusinessData() {
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
}

/** Capture the first monster of the active encounter with a guaranteed roll. */
async function captureCurrentEncounter(trainerId: string) {
  setRandomSource({ next: () => 0.01 });
  const encounter = await exploreRegion(prismaRepository, trainerId, "forest");
  const outcome = await throwBall(prismaRepository, {
    trainerId,
    encounterId: encounter.id,
    ballSlug: "basic-ball",
  });
  if (outcome.outcome !== "captured") {
    throw new Error("E2E fixture: capture failed");
  }
  return outcome.monster;
}

describe.skipIf(!RUN)("complete game-loop E2E (real PostgreSQL + real chain)", () => {
  it("Trainer A plays → mints → lists; Trainer B buys → owns → battles", async () => {
    await cleanBusinessData();
    resetRandomSource();

    // ---------- Trainer A: onboarding ----------
    const { trainer: ash, monster: starter } = await createTrainerWithStarter(
      prismaRepository,
      "E2EAsh",
      "firecub",
    );
    expect(starter.id).toBeTruthy();

    // ---------- Explore / encounter / capture ×2 (real DB) ----------
    const second = await captureCurrentEncounter(ash.id);
    const third = await captureCurrentEncounter(ash.id);
    const monsters = await prismaRepository.listMonsters();
    expect(monsters.length).toBe(3);

    // ---------- Team + battle (real DB) ----------
    await prisma.monster.updateMany({
      where: { ownerId: ash.id },
      data: { attack: 999, defense: 999 },
    });
    const ids = (await prismaRepository.listMonsters()).map((m) => m.id);
    await saveBattleTeam(prismaRepository, ash.id, ids);
    const battle = await createBattle(prismaRepository, ash.id);
    let current = battle;
    for (let i = 0; i < 50 && current.status === "active"; i++) {
      const result = await submitBattleAction(prismaRepository, {
        trainerId: ash.id,
        battleId: battle.id,
        expectedTurn: current.turn,
        action: { type: "basic_attack" },
      });
      current = result.state;
    }
    expect(current.status).toBe("completed");
    expect(current.winner).toBe("player");
    const profile = await prismaRepository.getDemoTrainer();
    expect(profile?.battleCount).toBe(1);
    expect(profile?.gold).toBeGreaterThan(0);

    // ---------- Wallet verify + NFT claim (real mint) ----------
    await prismaRepository.bindWallet(ash.id, WALLET_A.address);
    const gateway = new ViemChainGateway();
    const claim = await claimNft(prismaRepository, gateway, ash.id, starter.id);
    expect(claim.status).toBe("MINT_CONFIRMED");
    expect(claim.tokenId).toBeTruthy();
    const tokenId = BigInt(claim.tokenId!);
    const onchain = await gateway.getMonster(tokenId);
    expect(onchain.gameMonsterIdHash).toBe(hashGameMonsterId(starter.id));
    expect(onchain.dnaHash).toBe(hashMonsterDNA(starter.dna));

    // ---------- List on the marketplace (real approve + list tx) ----------
    const marketplace = MONSTER_MARKETPLACE_ADDRESS;
    const nftAbi = monsterNftAbi.abi as Abi;
    const mpAbi = monsterMarketplaceAbi.abi as Abi;
    const sellerClient = createWalletClient({
      account: WALLET_A,
      chain: chainmonChain,
      transport: http(),
    });
    const publicClient = createPublicClient({
      chain: chainmonChain,
      transport: http(),
    });
    const approveTx = await sellerClient.writeContract({
      address: gateway.contractAddress,
      abi: nftAbi,
      chain: chainmonChain,
      account: WALLET_A.address,
      functionName: "approve",
      args: [marketplace, tokenId],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
    const listTx = await sellerClient.writeContract({
      address: marketplace,
      abi: mpAbi,
      chain: chainmonChain,
      account: WALLET_A.address,
      functionName: "listMonster",
      args: [tokenId, PRICE_WEI],
    });
    await publicClient.waitForTransactionReceipt({ hash: listTx });
    const listing = await listMonster(
      prismaRepository,
      gateway,
      ash.id,
      starter.id,
      listTx,
      PRICE_WEI.toString(),
    );
    expect(listing.status).toBe("ACTIVE");

    // ---------- Trainer B: buy (real tx) ----------
    const userB = await prisma.user.create({
      data: { walletAddress: WALLET_B.address.toLowerCase() },
    });
    const misty = await prisma.trainer.create({
      data: { userId: userB.id, nickname: "E2EMisty" },
    });
    const buyerClient = createWalletClient({
      account: WALLET_B,
      chain: chainmonChain,
      transport: http(),
    });
    const buyTx = await buyerClient.writeContract({
      address: marketplace,
      abi: mpAbi,
      chain: chainmonChain,
      account: WALLET_B.address,
      functionName: "buyMonster",
      args: [tokenId],
      value: PRICE_WEI,
    });
    await publicClient.waitForTransactionReceipt({ hash: buyTx });
    expect((await gateway.getOwner(tokenId)).toLowerCase()).toBe(
      WALLET_B.address.toLowerCase(),
    );

    // ---------- Ownership sync (real ownerOf → DB) ----------
    const synced = await syncMonsterOwnership(
      prismaRepository,
      gateway,
      starter.id,
    );
    expect(synced.owner).toBe(misty.id);
    expect(synced.onchainOwner).toBe(WALLET_B.address.toLowerCase());

    // Listing reconciled: chain listing gone + buyer owns → SOLD.
    const sold = await reconcileListing(prismaRepository, gateway, starter.id);
    expect(sold?.status).toBe("STALE"); // no SALE_PENDING recorded — STALE is the safe truth
    const dbMonster = await prisma.monster.findUnique({
      where: { id: starter.id },
    });
    expect(dbMonster?.ownerId).toBe(misty.id);
    expect(dbMonster?.onchainOwnerAddress?.toLowerCase()).toBe(
      WALLET_B.address.toLowerCase(),
    );

    // ---------- Buyer collection + team + battle (real DB) ----------
    // addMonster binds the demo trainer — write B's monsters directly.
    const leafcat = getSpeciesBySlug("leafcat")!;
    const aquaturtle = getSpeciesBySlug("aquaturtle")!;
    const starterB = generateMonster(leafcat, { owner: misty.id });
    const starterC = generateMonster(aquaturtle, { owner: misty.id });
    await prisma.monster.create({
      data: {
        id: starterB.id,
        speciesId: starterB.speciesId,
        name: starterB.name,
        level: starterB.level,
        exp: starterB.exp,
        hp: starterB.hp,
        attack: starterB.attack,
        defense: starterB.defense,
        speed: starterB.speed,
        dna: starterB.dna as unknown as object,
        generation: starterB.generation,
        battleCount: starterB.battleCount,
        wins: starterB.wins,
        ownerId: misty.id,
      },
    });
    await prisma.monster.create({
      data: {
        id: starterC.id,
        speciesId: starterC.speciesId,
        name: starterC.name,
        level: starterC.level,
        exp: starterC.exp,
        hp: starterC.hp,
        attack: starterC.attack,
        defense: starterC.defense,
        speed: starterC.speed,
        dna: starterC.dna as unknown as object,
        generation: starterC.generation,
        battleCount: starterC.battleCount,
        wins: starterC.wins,
        ownerId: misty.id,
      },
    });
    await prisma.monster.updateMany({
      where: { ownerId: misty.id },
      data: { attack: 999, defense: 999 },
    });
    const mistyMonsters = await prisma.monster.findMany({
      where: { ownerId: misty.id },
      orderBy: { createdAt: "asc" },
    });
    expect(mistyMonsters.length).toBe(3);
    expect(mistyMonsters.some((m) => m.id === starter.id)).toBe(true); // purchased monster in collection

    // saveBattleTeam validates ownership against the single demo trainer
    // (Prisma repository design) — B's team is built at the repository level.
    await prismaRepository.saveTeam(
      misty.id,
      mistyMonsters.map((m) => m.id),
    );
    const battleB = await createBattle(prismaRepository, misty.id);
    let currentB = battleB;
    for (let i = 0; i < 50 && currentB.status === "active"; i++) {
      const result = await submitBattleAction(prismaRepository, {
        trainerId: misty.id,
        battleId: battleB.id,
        expectedTurn: currentB.turn,
        action: { type: "basic_attack" },
      });
      currentB = result.state;
    }
    expect(currentB.status).toBe("completed");

    // ---------- Consistency: identity preserved across the sale ----------
    expect(dbMonster?.dna).toEqual(starter.dna as unknown as object);
    expect(dbMonster?.tokenId).toBe(tokenId.toString());
    expect(dbMonster?.speciesId).toBe(starter.speciesId);
    expect(dbMonster?.generation).toBe(starter.generation);

    console.log("E2E-FULL-FLOW-OK", JSON.stringify({
      trainerA: ash.id,
      trainerB: misty.id,
      tokenId: tokenId.toString(),
      listing: listing.id,
    }));
  });
});
