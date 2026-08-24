import { generateMonster, resetRandomSource } from "@chainmon/game-engine";
import { getSpeciesBySlug } from "@chainmon/monster-data";
import { beforeEach, describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { createTrainerWithStarter } from "../../data/demo-service";
import { memoryRepository, resetMemoryRepository } from "../../data/memory-repository";
import type { GameRepository } from "../../data/types";
import { FakeChainGateway } from "../fake-gateway";
import { hashGameMonsterId, hashMonsterDNA } from "../hash";
import {
  evolveMintedMonster,
  EvolutionSyncError,
} from "../../services/evolution-sync-service";
import type { Monster } from "@chainmon/shared";

const WALLET = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const OTHER = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
);

let repository: GameRepository;
let gateway: FakeChainGateway;
let trainerId: string;
let monster: Monster;

/** Minted FireCub at Lv16 (eligible for FireWolf, no item needed). */
async function setupMintedFireCub(level = 16) {
  resetMemoryRepository();
  resetRandomSource();
  repository = memoryRepository;
  gateway = new FakeChainGateway();

  const { trainer } = await createTrainerWithStarter(
    repository,
    "Ash",
    "firecub",
  );
  trainerId = trainer.id;
  await repository.bindWallet(trainerId, WALLET.address);

  const fireCub = getSpeciesBySlug("firecub")!;
  monster = generateMonster(fireCub, { owner: trainerId });
  monster.level = level;
  monster.exp = 0;
  await repository.addMonster(monster);

  // Mint on chain + persist CONFIRMED in DB
  await gateway.mintMonster(WALLET.address.toLowerCase() as `0x${string}`, {
    gameMonsterIdHash: hashGameMonsterId(monster.id),
    speciesId: fireCub.id,
    generation: 1,
    rarity: 0,
    evolutionStage: 0,
    dnaHash: hashMonsterDNA(monster.dna),
  });
  await repository.setMintConfirmed(monster.id, "1", WALLET.address.toLowerCase());
  return trainer;
}

beforeEach(async () => {
  await setupMintedFireCub();
});

describe("evolveMintedMonster — two-phase evolution", () => {
  it("evolves chain-first, then syncs the game state", async () => {
    const fireWolf = getSpeciesBySlug("firewolf")!;
    const result = await evolveMintedMonster(
      repository,
      gateway,
      trainerId,
      monster.id,
    );
    expect(result.status).toBe("synced");

    // Chain updated
    const onchain = await gateway.getMonster(1n);
    expect(Number(onchain.speciesId)).toBe(fireWolf.id);
    expect(Number(onchain.evolutionStage)).toBe(1);

    // DB updated (species, history, job SYNCED)
    const dbMonster = await repository.getMonster(monster.id);
    expect(dbMonster?.speciesId).toBe(fireWolf.id);
    expect(dbMonster?.dna).toEqual(monster.dna);
    const history = await repository.getEvolutionHistory(monster.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.toSpeciesId).toBe(fireWolf.id);
    const jobs = await repository.getOnchainEvolutionByMonster(monster.id);
    expect(jobs[0]?.status).toBe("SYNCED");
    expect(jobs[0]?.txHash).toBeTruthy();
  });

  it("rejects evolution when the NFT ownership mismatches", async () => {
    gateway.state.owners.set(1n, OTHER.address.toLowerCase() as `0x${string}`);
    await expect(
      evolveMintedMonster(repository, gateway, trainerId, monster.id),
    ).rejects.toThrow(/ownership mismatch/);
    const dbMonster = await repository.getMonster(monster.id);
    expect(dbMonster?.speciesId).toBe(1); // unchanged
    expect(dbMonster?.ownershipMismatch).toBe(true);
  });

  it("keeps the DB unchanged when the chain transaction reverts", async () => {
    gateway.evolveResult = "reverted";
    const result = await evolveMintedMonster(
      repository,
      gateway,
      trainerId,
      monster.id,
    );
    expect(result.status).toBe("failed");

    const dbMonster = await repository.getMonster(monster.id);
    expect(dbMonster?.speciesId).toBe(1); // species unchanged
    expect(dbMonster?.dna).toEqual(monster.dna);
    expect(await repository.getEvolutionHistory(monster.id)).toHaveLength(0);
    const jobs = await repository.getOnchainEvolutionByMonster(monster.id);
    expect(jobs[0]?.status).toBe("SYNC_FAILED");
  });

  it("recovers a CHAIN_CONFIRMED job without sending a new transaction", async () => {
    // Simulate: chain evolved, DB commit failed, job stuck at CHAIN_CONFIRMED
    const fireWolf = getSpeciesBySlug("firewolf")!;
    gateway.state.monsters.get(1n)!.speciesId = BigInt(fireWolf.id);
    gateway.state.monsters.get(1n)!.evolutionStage = 1n;
    const created = await repository.createOnchainEvolution(monster.id, {
      fromSpeciesId: 1,
      toSpeciesId: fireWolf.id,
      fromStage: 0,
      toStage: 1,
    });
    if (created.status !== "created") throw new Error("fixture");
    await repository.setOnchainEvolutionStatus(created.job.id, "CHAIN_CONFIRMED", {
      confirmedAt: new Date(),
    });
    const evolveCallsBefore = gateway.evolveCalls;

    const result = await evolveMintedMonster(
      repository,
      gateway,
      trainerId,
      monster.id,
    );
    expect(result.status).toBe("synced");
    expect(gateway.evolveCalls).toBe(evolveCallsBefore); // NO new tx

    const dbMonster = await repository.getMonster(monster.id);
    expect(dbMonster?.speciesId).toBe(fireWolf.id);
    const jobs = await repository.getOnchainEvolutionByMonster(monster.id);
    expect(jobs[0]?.status).toBe("SYNCED");
  });

  it("does not double-evolve on repeated calls (one tx per evolution)", async () => {
    gateway.evolveResult = "pending"; // first call: submitted but not mined
    const first = await evolveMintedMonster(
      repository,
      gateway,
      trainerId,
      monster.id,
    );
    expect(first.status).toBe("submitted");
    expect(gateway.evolveCalls).toBe(1);

    const second = await evolveMintedMonster(
      repository,
      gateway,
      trainerId,
      monster.id,
    );
    // Job is EVOLUTION_SUBMITTED → no new tx, status stays submitted
    expect(second.status).toBe("submitted");
    expect(gateway.evolveCalls).toBe(1);

    const onchain = await gateway.getMonster(1n);
    expect(Number(onchain.evolutionStage)).toBe(0); // never skipped to 2
    const jobs = await repository.getOnchainEvolutionByMonster(monster.id);
    expect(jobs).toHaveLength(1);
  });

  it("rejects evolution for an OFFCHAIN monster (regular flow applies)", async () => {
    const offchain = generateMonster(getSpeciesBySlug("leafcat")!, {
      owner: trainerId,
    });
    await repository.addMonster(offchain);
    await expect(
      evolveMintedMonster(repository, gateway, trainerId, offchain.id),
    ).rejects.toThrow(/not minted/);
  });

  it("rejects evolution below the required level", async () => {
    await setupMintedFireCub(15); // FireCub needs Lv16
    await expect(
      evolveMintedMonster(repository, gateway, trainerId, monster.id),
    ).rejects.toThrow(/Level 16/);
    expect(gateway.evolveCalls).toBe(0);
  });

  it("rejects evolution for a monster the trainer does not own", async () => {
    await expect(
      evolveMintedMonster(repository, gateway, "someone-else", monster.id),
    ).rejects.toThrow(/don't own/);
  });
});
