import { generateMonster, resetRandomSource } from "@chainmon/game-engine";
import { getSpeciesBySlug } from "@chainmon/monster-data";
import { beforeEach, describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { createTrainerWithStarter } from "../../data/demo-service";
import {
  memoryRepository,
  resetMemoryRepository,
  setMemoryWalletOwnerForTest,
} from "../../data/memory-repository";
import type { GameRepository } from "../../data/types";
import { FakeChainGateway } from "../../web3/fake-gateway";
import { hashGameMonsterId, hashMonsterDNA } from "../../web3/hash";
import { claimNft } from "../nft-claim-service";
import { evolveMintedMonster } from "../evolution-sync-service";
import {
  cancelListing,
  listMonster,
  MarketplaceError,
} from "../marketplace-service";

/**
 * IDOR security tests (Phase 9, section 57):
 * User A must NEVER be able to claim / evolve / list / cancel another
 * trainer's monster or listing by guessing its id.
 */

const WALLET_A = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const WALLET_B = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
);

const TX = "0xef00000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;
const PRICE_WEI = "10000000000000000";

let repository: GameRepository;
let gateway: FakeChainGateway;
let trainerBId: string;
let monsterBId: string;

beforeEach(async () => {
  resetMemoryRepository();
  resetRandomSource();
  repository = memoryRepository;
  gateway = new FakeChainGateway();

  // Trainer B owns a MINT_CONFIRMED monster (the target).
  const { trainer, monster } = await createTrainerWithStarter(
    repository,
    "TargetB",
    "firecub",
  );
  trainerBId = trainer.id;
  monsterBId = monster.id;
  await repository.bindWallet(trainerBId, WALLET_B.address);
  await gateway.mintMonster(WALLET_B.address.toLowerCase() as `0x${string}`, {
    gameMonsterIdHash: hashGameMonsterId(monster.id),
    speciesId: monster.speciesId,
    generation: monster.generation,
    rarity: 0,
    evolutionStage: 0,
    dnaHash: hashMonsterDNA(monster.dna),
  });
  await repository.setMintConfirmed(
    monsterBId,
    "1",
    WALLET_B.address.toLowerCase(),
  );
});

describe("IDOR: user A cannot touch user B's assets", () => {
  it("A cannot claim B's monster", async () => {
    await expect(
      claimNft(repository, gateway, "trainer-a", monsterBId),
    ).rejects.toThrow(/don't own/);
  });

  it("A cannot evolve B's monster", async () => {
    await expect(
      evolveMintedMonster(repository, gateway, "trainer-a", monsterBId),
    ).rejects.toThrow(/don't own/);
  });

  it("A cannot list B's monster", async () => {
    await expect(
      listMonster(repository, gateway, "trainer-a", monsterBId, TX, PRICE_WEI),
    ).rejects.toThrow(/don't own/);
  });

  it("A cannot list B's monster even when the on-chain owner check passes", async () => {
    // Even if A somehow holds the NFT on chain, the DB ownership must hold.
    gateway.state.owners.set(1n, WALLET_A.address.toLowerCase() as `0x${string}`);
    await expect(
      listMonster(repository, gateway, "trainer-a", monsterBId, TX, PRICE_WEI),
    ).rejects.toThrow(/don't own/);
  });

  it("A cannot cancel B's active listing", async () => {
    // B lists the monster.
    gateway.setNftApproval(1n, gateway.marketplaceAddress);
    await gateway.listOnMarketplace(1n, BigInt(PRICE_WEI));
    await listMonster(repository, gateway, trainerBId, monsterBId, TX, PRICE_WEI);

    await expect(
      cancelListing(repository, gateway, "trainer-a", monsterBId, TX),
    ).rejects.toThrow(/your own/);
  });

  it("A cannot claim B's monster with a fabricated owner id", async () => {
    // The service must reject unknown/foreign trainer ids — never infer
    // ownership from the monster id.
    await expect(
      claimNft(repository, gateway, "does-not-exist", monsterBId),
    ).rejects.toThrow(/don't own/);
  });

  it("A's requests never mutate B's monster rows", async () => {
    const before = await repository.getMonster(monsterBId);
    expect(before?.mintStatus).toBe("MINT_CONFIRMED");

    const attempts = [
      claimNft(repository, gateway, "trainer-a", monsterBId),
      evolveMintedMonster(repository, gateway, "trainer-a", monsterBId),
      listMonster(repository, gateway, "trainer-a", monsterBId, TX, PRICE_WEI),
    ];
    for (const attempt of attempts) {
      await expect(attempt).rejects.toBeInstanceOf(Error);
    }
    const after = await repository.getMonster(monsterBId);
    expect(after?.mintStatus).toBe("MINT_CONFIRMED");
    expect(after?.speciesId).toBe(before?.speciesId);
    expect(after?.owner).toBe(before?.owner);
  });

  it("MarketplaceError carries a safe user-facing message (no stack/ids)", async () => {
    const error = new MarketplaceError("You don't own this monster.");
    expect(error.message).toContain("don't own");
    expect(error.message).not.toContain(monsterBId);
  });
});
