import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { prisma } from "@/lib/prisma";
import { prismaRepository } from "../prisma-repository";
import { createTrainerWithStarter } from "../demo-service";
import { evolveMintedMonster } from "../../services/evolution-sync-service";
import { ViemChainGateway } from "../../web3/server-client";
import { hashGameMonsterId, hashMonsterDNA } from "../../web3/hash";

/**
 * EVOLUTION E2E (Phase 9, section 47): minted FireCub Lv16 fixture →
 * real on-chain evolution → DB sync.
 *   Chain species: FireCub → FireWolf
 *   DB species:    FireCub → FireWolf
 *   tokenId unchanged, DNA unchanged
 *
 * Run explicitly (hardhat node + PostgreSQL must be up):
 *   RUN_E2E=1 RUN_CHAIN_INTEGRATION=1 ... (chain + db env) \
 *   npx vitest run apps/web/lib/data/__tests__/e2e-evolution.test.ts
 */

const RUN = process.env.RUN_E2E === "1";

const WALLET_A = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);

describe.skipIf(!RUN)("evolution E2E (real PostgreSQL + real chain)", () => {
  it("minted FireCub Lv16 → FireWolf on-chain and in DB, identity preserved", async () => {
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

    // Fixture: FireCub Lv16 with the Fire Stone for evolution.
    const { trainer, monster } = await createTrainerWithStarter(
      prismaRepository,
      "EvoRed",
      "firecub",
    );
    await prismaRepository.bindWallet(trainer.id, WALLET_A.address);
    const fireStone = await prisma.item.findUnique({
      where: { slug: "fire-stone" },
    });
    if (fireStone) {
      const inventory = await prisma.inventory.findUnique({
        where: { trainerId_itemId: { trainerId: trainer.id, itemId: fireStone.id } },
      });
      if (!inventory) {
        await prisma.inventory.create({
          data: {
            trainerId: trainer.id,
            itemId: fireStone.id,
            quantity: 1,
          },
        });
      } else {
        await prisma.inventory.update({
          where: { trainerId_itemId: { trainerId: trainer.id, itemId: fireStone.id } },
          data: { quantity: { increment: 1 } },
        });
      }
    }
    await prisma.monster.update({
      where: { id: monster.id },
      data: { level: 16, exp: 1600 },
    });

    // Real mint.
    const gateway = new ViemChainGateway();
    const payload = {
      gameMonsterIdHash: hashGameMonsterId(monster.id),
      speciesId: monster.speciesId, // 1 = FireCub
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

    const before = await gateway.getMonster(tokenId);
    expect(Number(before.speciesId)).toBe(1); // FireCub
    expect(Number(before.evolutionStage)).toBe(0);

    // Real on-chain evolution (FireCub → FireWolf, stage 0 → 1).
    const result = await evolveMintedMonster(
      prismaRepository,
      gateway,
      trainer.id,
      monster.id,
    );
    expect(result.status).toBe("synced");

    // Chain state.
    const onchain = await gateway.getMonster(tokenId);
    expect(Number(onchain.speciesId)).toBe(2); // FireWolf
    expect(Number(onchain.evolutionStage)).toBe(1);
    expect(onchain.dnaHash).toBe(payload.dnaHash); // DNA immutable
    expect(onchain.gameMonsterIdHash).toBe(payload.gameMonsterIdHash);

    // DB state.
    const db = await prisma.monster.findUnique({ where: { id: monster.id } });
    expect(db?.speciesId).toBe(2);
    expect(db?.tokenId).toBe(tokenId.toString()); // tokenId unchanged
    expect(db?.level).toBe(16);
    expect((db?.dna as { dnaHash?: string }) ?? {}).toBeDefined();

    // Evolution history + on-chain job synced.
    const history = await prisma.monsterEvolution.findMany({
      where: { monsterId: monster.id },
    });
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0]?.fromSpeciesId).toBe(1);
    expect(history[0]?.toSpeciesId).toBe(2);
    const job = await prisma.onchainEvolution.findFirst({
      where: { monsterId: monster.id },
      orderBy: { createdAt: "desc" },
    });
    expect(job?.status).toBe("SYNCED");
    expect(job?.txHash).toBeTruthy();

    console.log("E2E-EVOLUTION-OK", JSON.stringify({
      tokenId: tokenId.toString(),
      speciesId: Number(onchain.speciesId),
      stage: Number(onchain.evolutionStage),
    }));
  });
});
