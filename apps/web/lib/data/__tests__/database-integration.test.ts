import {
  generateMonster,
  getCaptureBall,
  resetRandomSource,
  setRandomSource,
} from "@chainmon/game-engine";
import { getSpeciesBySlug } from "@chainmon/monster-data";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { prisma } from "@/lib/prisma";
import { prismaRepository } from "../prisma-repository";
import { createTrainerWithStarter } from "../demo-service";
import type { GameRepository } from "../types";
import { exploreRegion } from "../../services/explore-service";
import { throwBall } from "../../services/capture-service";
import {
  createBattle,
  saveBattleTeam,
  submitBattleAction,
} from "../../services/battle-service";
import { evolveMintedMonster } from "../../services/evolution-sync-service";
import {
  claimNft,
} from "../../services/nft-claim-service";
import {
  cancelListing,
  listMonster,
  reconcileListing,
} from "../../services/marketplace-service";
import { syncMonsterOwnership } from "../../services/ownership-sync-service";
import { FakeChainGateway } from "../../web3/fake-gateway";
import { hashGameMonsterId, hashMonsterDNA } from "../../web3/hash";

/**
 * REAL-PostgreSQL integration tests.
 *
 * Run only when explicitly enabled (a real PostgreSQL must be reachable via
 * DATABASE_URL, seeded with `npm run db:seed`):
 *   RUN_DATABASE_INTEGRATION=1 npx vitest run \
 *     apps/web/lib/data/__tests__/database-integration.test.ts
 *
 * Skipped by default — ordinary CI/dev runs never touch the database.
 * WARNING: these tests DELETE business data (trainers/monsters/…) from the
 * connected database; seed rows (species/skills/items) are preserved.
 */

const RUN = process.env.RUN_DATABASE_INTEGRATION === "1";

const WALLET_A = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const WALLET_B = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
);

const TX = "0xef00000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;
const PRICE_WEI = "10000000000000000"; // 0.01 ETH

describe.skipIf(!RUN)("real PostgreSQL integration (prismaRepository)", () => {
  let repository: GameRepository;

  async function cleanBusinessData() {
    // Wipe business data; seed rows (species/skills/items) are preserved.
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

  beforeAll(async () => {
    // Prisma repository is a single-demo-trainer design (DEMO_EMAIL upsert):
    // every test starts from a clean business-data state.
    await cleanBusinessData();
    repository = prismaRepository;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    resetRandomSource();
    // Isolate tests: trainer, monsters, battles, listings from previous
    // tests must not leak into the next one.
    await cleanBusinessData();
  });

  // ---------------- Trainer CRUD ----------------

  describe("Trainer CRUD (real PostgreSQL)", () => {
    it("creates, reads and updates a trainer", async () => {
      const trainer = await repository.createDemoTrainer("Ash");
      expect(trainer.id).toBeTruthy();
      expect(trainer.nickname).toBe("Ash");

      const read = await repository.getDemoTrainer();
      expect(read?.id).toBe(trainer.id);

      // Update: wins/battleCount/gold via battle stats are written by
      // submitRound — verify the trainer row accepts updates.
      await prisma.trainer.update({
        where: { id: trainer.id },
        data: { gold: 42, battleCount: 3, wins: 1 },
      });
      const updated = await repository.getDemoTrainer();
      expect(updated?.gold).toBe(42);
      expect(updated?.battleCount).toBe(3);
      expect(updated?.wins).toBe(1);
    });
  });

  // ---------------- Capture CRUD ----------------

  describe("Capture CRUD (real PostgreSQL)", () => {
    it("explores → encounters → captures → persists the monster and consumes the ball", async () => {
      const { trainer } = await createTrainerWithStarter(
        repository,
        "Misty",
        "aquaturtle",
      );
      const inventoryBefore = await repository.getInventory(trainer.id);
      expect(
        inventoryBefore.find((i) => i.slug === "basic-ball")?.quantity,
      ).toBe(20);

      // Deterministic capture: force a low roll so capture succeeds.
      setRandomSource({ next: () => 0.01 });

      const encounter = await exploreRegion(repository, trainer.id, "forest");
      expect(encounter.id).toBeTruthy();
      expect(encounter.status).toBe("active");

      const outcome = await throwBall(repository, {
        trainerId: trainer.id,
        encounterId: encounter.id,
        ballSlug: "basic-ball",
      });
      if (outcome.outcome !== "captured") {
        throw new Error(`E2E fixture: capture failed (${outcome.outcome})`);
      }

      // Monster persisted with owner + species + DNA.
      const monsters = await repository.listMonsters();
      const captured = monsters.find((m) => m.id === outcome.monster.id);
      expect(captured).toBeDefined();
      expect(captured?.owner).toBe(trainer.id);
      expect(captured?.speciesId).toBe(encounter.speciesId);
      expect(captured?.dna).toBeDefined();

      // Encounter is no longer active.
      const active = await repository.getActiveEncounter(trainer.id);
      expect(active).toBeNull();

      // Ball consumed.
      const inventoryAfter = await repository.getInventory(trainer.id);
      expect(
        inventoryAfter.find((i) => i.slug === "basic-ball")?.quantity,
      ).toBe(19);
    });
  });

  // ---------------- Battle CRUD ----------------

  describe("Battle CRUD (real PostgreSQL)", () => {
    async function buildTeam() {
      const { trainer, monster } = await createTrainerWithStarter(
        repository,
        "Brock",
        "firecub",
      );
      const second = generateMonster(getSpeciesBySlug("leafcat")!, {
        owner: trainer.id,
      });
      const third = generateMonster(getSpeciesBySlug("aquaturtle")!, {
        owner: trainer.id,
      });
      await repository.addMonster(second);
      await repository.addMonster(third);
      const monsters = await repository.listMonsters();
      // Buff stats directly in PostgreSQL so the player reliably wins.
      await prisma.monster.updateMany({
        where: { ownerId: trainer.id },
        data: { attack: 999, defense: 999 },
      });
      return { trainer, ids: monsters.map((m) => m.id) };
    }

    it("saves a team, runs rounds to completion and persists rewards/EXP", async () => {
      const { trainer, ids } = await buildTeam();
      await saveBattleTeam(repository, trainer.id, ids);
      const team = await repository.getTeam(trainer.id);
      expect(team).toHaveLength(3);

      const battle = await createBattle(repository, trainer.id);
      expect(battle.status).toBe("active");

      let current = battle;
      for (let i = 0; i < 50 && current.status === "active"; i++) {
        const result = await submitBattleAction(repository, {
          trainerId: trainer.id,
          battleId: battle.id,
          expectedTurn: current.turn,
          action: { type: "basic_attack" },
        });
        current = result.state;
      }
      expect(current.status).toBe("completed");
      expect(current.winner).toBe("player");

      // Rewards snapshot persisted.
      const record = await repository.getBattleById(battle.id);
      expect(record?.rewards).toBeDefined();
      expect(record?.rewards?.gold).toBeGreaterThan(0);

      // Trainer stats persisted.
      const profile = await repository.getDemoTrainer();
      expect(profile?.battleCount).toBe(1);
      expect(profile?.wins).toBe(1);

      // Battle summary listable.
      const summaries = await repository.getTrainerBattles(trainer.id);
      expect(summaries.length).toBeGreaterThanOrEqual(1);
      expect(summaries[0]?.status).toBe("completed");
    });
  });

  // ---------------- Evolution CRUD ----------------

  describe("Evolution CRUD (real PostgreSQL)", () => {
    it("evolves a minted FireCub into FireWolf and writes history", async () => {
      const { trainer, monster } = await createTrainerWithStarter(
        repository,
        "Red",
        "firecub",
      );
      const fireCub = getSpeciesBySlug("firecub")!;
      const fireWolf = getSpeciesBySlug("firewolf")!;

      // Mint state: simulate a minted FireCub (verified wallet A).
      await repository.bindWallet(trainer.id, WALLET_A.address);
      await repository.setMintConfirmed(monster.id, "77", WALLET_A.address.toLowerCase());

      // Fixture: bump level to 16 so evolution is eligible.
      const evolvedFixture = {
        ...monster,
        level: 16,
        exp: 1500,
      };
      await prisma.monster.update({
        where: { id: monster.id },
        data: { level: 16, exp: 1500 },
      });
      void evolvedFixture;

      const gateway = new FakeChainGateway();
      // On-chain state still FireCub (stage 0) — evolveMonster will flip it.
      gateway.state.owners.set(77n, WALLET_A.address.toLowerCase() as `0x${string}`);
      gateway.state.monsters.set(77n, {
        speciesId: BigInt(fireCub.id),
        generation: 1n,
        rarity: 0n,
        evolutionStage: 0n,
        dnaHash: hashMonsterDNA(monster.dna),
        gameMonsterIdHash: hashGameMonsterId(monster.id),
      });

      const result = await evolveMintedMonster(repository, gateway, trainer.id, monster.id);
      expect(result.status).toBe("synced");

      const after = await repository.getMonster(monster.id);
      expect(after?.speciesId).toBe(fireWolf.id);
      expect(after?.tokenId).toBe("77");

      // History row written.
      const history = await repository.getEvolutionHistory(monster.id);
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0]?.fromSpeciesId).toBe(fireCub.id);
      expect(history[0]?.toSpeciesId).toBe(fireWolf.id);
    });
  });

  // ---------------- NFT claim DB state machine ----------------

  describe("NFT claim DB state (real PostgreSQL + fake chain)", () => {
    it("OFFCHAIN → MINT_PENDING → MINT_SUBMITTED → MINT_CONFIRMED with full fields", async () => {
      const { trainer, monster } = await createTrainerWithStarter(
        repository,
        "Green",
        "leafcat",
      );
      await repository.bindWallet(trainer.id, WALLET_A.address);

      const gateway = new FakeChainGateway();

      const result = await claimNft(repository, gateway, trainer.id, monster.id);
      expect(result.status).toBe("MINT_CONFIRMED");
      expect(result.tokenId).toBe("1");

      const db = await prisma.monster.findUnique({ where: { id: monster.id } });
      expect(db?.mintStatus).toBe("MINT_CONFIRMED");
      expect(db?.tokenId).toBe("1");
      expect(db?.mintTxHash).toBeTruthy();
      expect(db?.mintChainId).toBe(31337);
      expect(db?.mintContractAddress).toBeTruthy();
      expect(db?.mintRecipient?.toLowerCase()).toBe(WALLET_A.address.toLowerCase());
      expect(db?.mintSubmittedAt).toBeInstanceOf(Date);
      expect(db?.mintConfirmedAt).toBeInstanceOf(Date);
    });
  });

  // ---------------- Mint CAS concurrency ----------------

  describe("Mint CAS concurrency (real PostgreSQL)", () => {
    it("two concurrent claims on the same monster → only one acquires the lock", async () => {
      const { trainer, monster } = await createTrainerWithStarter(
        repository,
        "Blue",
        "firecub",
      );
      await repository.bindWallet(trainer.id, WALLET_A.address);

      // Two concurrent CAS attempts — only one may win MINT_PENDING.
      const [a, b] = await Promise.all([
        repository.tryAcquireMintLock(monster.id),
        repository.tryAcquireMintLock(monster.id),
      ]);
      const wins = [a, b].filter((r) => r === "acquired").length;
      expect(wins).toBe(1);

      const db = await prisma.monster.findUnique({ where: { id: monster.id } });
      expect(db?.mintStatus).toBe("MINT_PENDING");
    });
  });

  // ---------------- Marketplace CRUD ----------------

  describe("Marketplace CRUD (real PostgreSQL)", () => {
    async function setupMintedMonster(nickname: string) {
      const { trainer, monster } = await createTrainerWithStarter(
        repository,
        nickname,
        "firecub",
      );
      await repository.bindWallet(trainer.id, WALLET_A.address);
      // Mirror the same mint on the fake chain so seller eligibility passes.
      const gateway = new FakeChainGateway();
      await gateway.mintMonster(WALLET_A.address.toLowerCase() as `0x${string}`, {
        gameMonsterIdHash: hashGameMonsterId(monster.id),
        speciesId: monster.speciesId,
        generation: monster.generation,
        rarity: 0,
        evolutionStage: 0,
        dnaHash: hashMonsterDNA(monster.dna),
      });
      const tokenId = await gateway.getTokenIdByGameMonsterId(
        hashGameMonsterId(monster.id),
      );
      await repository.setMintConfirmed(
        monster.id,
        tokenId.toString(),
        WALLET_A.address.toLowerCase(),
      );
      return { trainer, monster, gateway, tokenId };
    }

    it("PENDING → ACTIVE → SALE_PENDING → SOLD (status machine persisted)", async () => {
      const { trainer, monster, gateway, tokenId } =
        await setupMintedMonster("SellerOne");
      gateway.setNftApproval(tokenId, gateway.marketplaceAddress);
      await gateway.listOnMarketplace(tokenId, BigInt(PRICE_WEI));

      const listing = await listMonster(
        repository,
        gateway,
        trainer.id,
        monster.id,
        TX,
        PRICE_WEI,
      );
      expect(listing.status).toBe("ACTIVE");

      // Full sale state machine at the repository level (the buyer-wallet
      // requirement ties confirmSale to a single demo trainer in the Prisma
      // repository — see Known Limitations).
      await repository.updateListingStatus(listing.id, {
        status: "SALE_PENDING",
        txHash: TX,
        buyerWallet: WALLET_B.address.toLowerCase(),
      });
      await repository.updateListingStatus(listing.id, {
        status: "SOLD",
        soldAt: new Date(),
      });

      const dbListing = await prisma.marketplaceListing.findUnique({
        where: { id: listing.id },
      });
      expect(dbListing?.status).toBe("SOLD");
      expect(dbListing?.saleTxHash).toBe(TX);
      expect(dbListing?.buyerWallet?.toLowerCase()).toBe(
        WALLET_B.address.toLowerCase(),
      );
      expect(dbListing?.soldAt).toBeInstanceOf(Date);
    });

    it("PENDING → ACTIVE → CANCEL_PENDING → CANCELLED", async () => {
      const { trainer, monster, gateway, tokenId } =
        await setupMintedMonster("SellerTwo");
      gateway.setNftApproval(tokenId, gateway.marketplaceAddress);
      await gateway.listOnMarketplace(tokenId, BigInt(PRICE_WEI));
      await listMonster(repository, gateway, trainer.id, monster.id, TX, PRICE_WEI);

      const cancelled = await cancelListing(
        repository,
        gateway,
        trainer.id,
        monster.id,
        TX,
      );
      expect(cancelled.status).toBe("CANCELLED");
    });

    it("reconcile marks STALE when the chain listing disappeared", async () => {
      const { trainer, monster, gateway, tokenId } =
        await setupMintedMonster("SellerThree");
      gateway.setNftApproval(tokenId, gateway.marketplaceAddress);
      await gateway.listOnMarketplace(tokenId, BigInt(PRICE_WEI));
      await listMonster(repository, gateway, trainer.id, monster.id, TX, PRICE_WEI);

      gateway.marketplaceListings.delete(tokenId);
      const listing = await reconcileListing(repository, gateway, monster.id);
      expect(listing?.status).toBe("STALE");
    });
  });

  // ---------------- Ownership sync + team cleanup ----------------

  describe("Ownership sync + team cleanup (real PostgreSQL)", () => {
    it("A → B: syncMonsterOwnership moves ownerId and clears stale team slots", async () => {
      const { trainer, monster } = await createTrainerWithStarter(
        repository,
        "OwnerA",
        "aquaturtle",
      );
      await repository.bindWallet(trainer.id, WALLET_A.address);
      await repository.setMintConfirmed(monster.id, "55", WALLET_A.address.toLowerCase());

      // Trainer B with wallet B (second trainer row).
      const userB = await prisma.user.create({
        data: { walletAddress: WALLET_B.address.toLowerCase() },
      });
      const trainerB = await prisma.trainer.create({
        data: { userId: userB.id, nickname: "OwnerB" },
      });

      // Put the monster into A's team first.
      const monsterB = generateMonster(getSpeciesBySlug("firecub")!, {
        owner: trainer.id,
      });
      const monsterC = generateMonster(getSpeciesBySlug("leafcat")!, {
        owner: trainer.id,
      });
      await repository.addMonster(monsterB);
      await repository.addMonster(monsterC);
      const ids = (await repository.listMonsters()).map((m) => m.id);
      await saveBattleTeam(repository, trainer.id, ids);
      expect(await repository.getTeam(trainer.id)).toHaveLength(3);

      // NFT moved A → B on chain.
      const gateway = new FakeChainGateway();
      gateway.state.owners.set(55n, WALLET_B.address.toLowerCase() as `0x${string}`);

      const result = await syncMonsterOwnership(repository, gateway, monster.id);
      expect(result.owner).toBe(trainerB.id);
      expect(result.onchainOwner).toBe(WALLET_B.address.toLowerCase());

      const db = await prisma.monster.findUnique({ where: { id: monster.id } });
      expect(db?.ownerId).toBe(trainerB.id);
      expect(db?.onchainOwnerAddress).toBe(WALLET_B.address.toLowerCase());

      // Stale team slots removed: A's team now has only 2 monsters → null.
      const teamAfter = await repository.getTeam(trainer.id);
      expect(teamAfter).toBeNull();
      const slots = await prisma.teamSlot.count({ where: { trainerId: trainer.id } });
      expect(slots).toBe(2);
    });

    it("external owner: no ChainMon trainer → owner null + onchain address kept", async () => {
      const { trainer, monster } = await createTrainerWithStarter(
        repository,
        "OwnerC",
        "firecub",
      );
      await repository.bindWallet(trainer.id, WALLET_A.address);
      await repository.setMintConfirmed(monster.id, "56", WALLET_A.address.toLowerCase());

      const walletC = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc";
      const gateway = new FakeChainGateway();
      gateway.state.owners.set(56n, walletC as `0x${string}`);

      const result = await syncMonsterOwnership(repository, gateway, monster.id);
      expect(result.owner).toBeNull();
      expect(result.onchainOwner).toBe(walletC);

      const db = await prisma.monster.findUnique({ where: { id: monster.id } });
      expect(db?.ownerId).toBeNull();
      expect(db?.onchainOwnerAddress).toBe(walletC);
    });
  });

  // ---------------- Capture ball inventory sanity ----------------

  it("starter inventory rows exist (seeded items linked to trainers)", async () => {
    const { trainer } = await createTrainerWithStarter(
      repository,
      "InventoryCheck",
      "firecub",
    );
    const inventory = await repository.getInventory(trainer.id);
    const basic = inventory.find((i) => i.slug === "basic-ball");
    expect(basic).toBeDefined();
    expect(basic?.quantity).toBe(20);
    expect(getCaptureBall("basic-ball")).toBeDefined();
  });
});

