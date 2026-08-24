import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { prismaRepository } from "../prisma-repository";

/**
 * RESTART PERSISTENCE verify (Phase 9, section 26).
 *
 * Run AFTER persistence-setup.test.ts and a web-server restart:
 *   RUN_DB_PERSISTENCE=1 npx vitest run \
 *     apps/web/lib/data/__tests__/persistence-verify.test.ts
 *
 * Proves the data written before the restart still exists in real
 * PostgreSQL (trainer → monster → mint → listing).
 */

const RUN = process.env.RUN_DB_PERSISTENCE === "1";

describe.skipIf(!RUN)("persistence verify (after server restart)", () => {
  it("reads back the trainer, monster, mint and listing created before restart", async () => {
    const trainer = await prismaRepository.getDemoTrainer();
    expect(trainer).not.toBeNull();
    expect(trainer?.nickname).toBe("PersistTrainer");

    const monsters = await prismaRepository.listMonsters();
    expect(monsters.length).toBeGreaterThanOrEqual(1);
    const monster = monsters[0];
    expect(monster).toBeDefined();
    expect(monster?.mintStatus).toBe("MINT_CONFIRMED");
    expect(monster?.tokenId).toBeTruthy();

    // Buyer trainer B exists.
    const buyerTrainer = await prisma.trainer.findUnique({
      where: { nickname: "PersistBuyer" },
    });
    expect(buyerTrainer).not.toBeNull();

    // Listing is ACTIVE with the full payload.
    const listing = await prisma.marketplaceListing.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });
    expect(listing).not.toBeNull();
    expect(listing?.sellerId).toBe(trainer?.id);
    expect(listing?.priceWei).toBe(10000000000000000n);
    expect(listing?.tokenId).toBeTruthy();
    expect(listing?.nftContractAddress).toBeTruthy();
    expect(listing?.marketplaceAddress).toBeTruthy();
    expect(listing?.listingTxHash).toBeTruthy();
  });
});
