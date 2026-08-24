import { generateMonster, resetRandomSource } from "@chainmon/game-engine";
import { getSpeciesBySlug } from "@chainmon/monster-data";
import { beforeEach, describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { createTrainerWithStarter } from "../../data/demo-service";
import { memoryRepository, resetMemoryRepository } from "../../data/memory-repository";
import type { GameRepository } from "../../data/types";
import { FakeChainGateway } from "../fake-gateway";
import { hashGameMonsterId } from "../hash";
import {
  claimNft,
  ClaimError,
  refreshMintStatus,
} from "../../services/nft-claim-service";

const WALLET = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);

let repository: GameRepository;
let gateway: FakeChainGateway;
let trainerId: string;
let monsterId: string;

beforeEach(async () => {
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
  const monster = generateMonster(getSpeciesBySlug("firecub")!, {
    owner: trainerId,
  });
  await repository.addMonster(monster);
  monsterId = monster.id;
  await repository.bindWallet(trainerId, WALLET.address);
});

describe("claimNft — authorization", () => {
  it("rejects a monster the trainer does not own", async () => {
    await expect(
      claimNft(repository, gateway, "someone-else", monsterId),
    ).rejects.toThrow(/don't own/);
  });

  it("rejects when no wallet is verified", async () => {
    resetMemoryRepository();
    const { trainer } = await createTrainerWithStarter(
      repository,
      "Ash",
      "firecub",
    );
    trainerId = trainer.id;
    const monster = generateMonster(getSpeciesBySlug("firecub")!, {
      owner: trainerId,
    });
    await repository.addMonster(monster);
    monsterId = monster.id;

    await expect(
      claimNft(repository, gateway, trainerId, monsterId),
    ).rejects.toThrow(/Verify a wallet first/);
  });
});

describe("claimNft — happy path", () => {
  it("runs OFFCHAIN → PENDING → SUBMITTED → CONFIRMED and persists everything", async () => {
    const statsBefore = await repository.getMonster(monsterId);

    const result = await claimNft(repository, gateway, trainerId, monsterId);
    expect(result.status).toBe("MINT_CONFIRMED");
    expect(result.tokenId).toBe("1");

    const monster = await repository.getMonster(monsterId);
    expect(monster?.mintStatus).toBe("MINT_CONFIRMED");
    expect(monster?.tokenId).toBe("1"); // string, never Number
    expect(monster?.mintTxHash).toBeTruthy();
    expect(monster?.mintChainId).toBe(31337);
    expect(monster?.mintContractAddress).toBe(gateway.contractAddress);
    expect(monster?.mintRecipient).toBe(WALLET.address.toLowerCase());

    // On-chain state matches
    expect(await gateway.getOwner(1n)).toBe(WALLET.address.toLowerCase());
    const onchain = await gateway.getMonster(1n);
    expect(onchain.gameMonsterIdHash).toBe(hashGameMonsterId(monsterId));
    expect(Number(onchain.speciesId)).toBe(1);
    expect(Number(onchain.generation)).toBe(1);

    // Claim does NOT change game stats or ownership
    const statsAfter = await repository.getMonster(monsterId);
    expect(statsAfter?.level).toBe(statsBefore?.level);
    expect(statsAfter?.exp).toBe(statsBefore?.exp);
    expect(statsAfter?.hp).toBe(statsBefore?.hp);
    expect(statsAfter?.attack).toBe(statsBefore?.attack);
    expect(statsAfter?.dna).toEqual(statsBefore?.dna);
    expect(statsAfter?.owner).toBe(trainerId);
  });

  it("does not mint twice on a second claim (CONFIRMED short-circuit)", async () => {
    await claimNft(repository, gateway, trainerId, monsterId);
    const result = await claimNft(repository, gateway, trainerId, monsterId);
    expect(result.status).toBe("MINT_CONFIRMED");
    expect(result.tokenId).toBe("1");
    expect(gateway.mintCalls).toBe(1);
  });

  it("rejects a second claim while MINT_PENDING is in progress", async () => {
    const lock = await repository.tryAcquireMintLock(monsterId);
    expect(lock).toBe("acquired");
    await expect(
      claimNft(repository, gateway, trainerId, monsterId),
    ).rejects.toThrow(/already in progress/);
    expect(gateway.mintCalls).toBe(0);
  });
});

describe("claimNft — recovery & reconciliation", () => {
  it("recovers an already-minted NFT without sending a new transaction", async () => {
    // Chain already holds the NFT (crash after mint, DB never updated)
    await gateway.mintMonster(WALLET.address.toLowerCase() as `0x${string}`, {
      gameMonsterIdHash: hashGameMonsterId(monsterId),
      speciesId: 1,
      generation: 1,
      rarity: 0,
      evolutionStage: 0,
      dnaHash: (
        await import("../hash")
      ).hashMonsterDNA((await repository.getMonster(monsterId))!.dna),
    });
    const callsBefore = gateway.mintCalls; // = 1 (the pre-mint above)

    const result = await claimNft(repository, gateway, trainerId, monsterId);
    expect(result.status).toBe("MINT_CONFIRMED");
    expect(result.recovered).toBe(true);
    expect(gateway.mintCalls).toBe(callsBefore); // no new tx

    const monster = await repository.getMonster(monsterId);
    expect(monster?.mintStatus).toBe("MINT_CONFIRMED");
    expect(monster?.tokenId).toBe("1");
  });

  it("reconciles a stuck MINT_PENDING into CONFIRMED when the chain has the NFT", async () => {
    await repository.tryAcquireMintLock(monsterId); // stuck PENDING (crash)
    const stuckMonster = await repository.getMonster(monsterId);
    if (stuckMonster) {
      stuckMonster.mintUpdatedAt = new Date(Date.now() - 10 * 60 * 1000);
    }
    await gateway.mintMonster(WALLET.address.toLowerCase() as `0x${string}`, {
      gameMonsterIdHash: hashGameMonsterId(monsterId),
      speciesId: 1,
      generation: 1,
      rarity: 0,
      evolutionStage: 0,
      dnaHash: (
        await import("../hash")
      ).hashMonsterDNA((await repository.getMonster(monsterId))!.dna),
    });
    const callsBefore = gateway.mintCalls;

    const result = await claimNft(repository, gateway, trainerId, monsterId);
    expect(result.status).toBe("MINT_CONFIRMED");
    expect(result.recovered).toBe(true);
    expect(gateway.mintCalls).toBe(callsBefore);
  });

  it("recovers SUBMITTED with a success receipt into CONFIRMED", async () => {
    const txHash = await gateway.mintMonster(
      WALLET.address.toLowerCase() as `0x${string}`,
      {
        gameMonsterIdHash: hashGameMonsterId(monsterId),
        speciesId: 1,
        generation: 1,
        rarity: 0,
        evolutionStage: 0,
        dnaHash: (
          await import("../hash")
        ).hashMonsterDNA((await repository.getMonster(monsterId))!.dna),
      },
    );
    await repository.setMintSubmitted(monsterId, {
      txHash,
      chainId: 31337,
      contractAddress: gateway.contractAddress,
      recipient: WALLET.address.toLowerCase(),
    });

    const result = await refreshMintStatus(
      repository,
      gateway,
      trainerId,
      monsterId,
    );
    expect(result.status).toBe("MINT_CONFIRMED");
    expect(result.tokenId).toBe("1");
  });

  it("keeps SUBMITTED when the receipt is pending (never FAILED)", async () => {
    gateway.mintResult = "pending";
    const result = await claimNft(repository, gateway, trainerId, monsterId);
    expect(result.status).toBe("MINT_SUBMITTED");
    expect(result.txHash).toBeTruthy();
    const monster = await repository.getMonster(monsterId);
    expect(monster?.mintStatus).toBe("MINT_SUBMITTED");
  });

  it("marks FAILED on a reverted mint and allows retry", async () => {
    gateway.mintResult = "reverted";
    await expect(
      claimNft(repository, gateway, trainerId, monsterId),
    ).rejects.toThrow(/rejected by the contract/);
    const monster = await repository.getMonster(monsterId);
    expect(monster?.mintStatus).toBe("MINT_FAILED");
    expect(monster?.mintError).toBeTruthy();

    // Retry after FAILED: reconcile first (chain has nothing), then mint
    gateway.mintResult = "success";
    const retry = await claimNft(repository, gateway, trainerId, monsterId);
    expect(retry.status).toBe("MINT_CONFIRMED");
    expect(gateway.mintCalls).toBe(2);
  });

  it("refuses to confirm when on-chain DNA mismatches the game data", async () => {
    await gateway.mintMonster(WALLET.address.toLowerCase() as `0x${string}`, {
      gameMonsterIdHash: hashGameMonsterId(monsterId),
      speciesId: 1,
      generation: 1,
      rarity: 0,
      evolutionStage: 0,
      dnaHash: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    });
    await expect(
      claimNft(repository, gateway, trainerId, monsterId),
    ).rejects.toThrow(/DNA mismatch/);
    const monster = await repository.getMonster(monsterId);
    expect(monster?.mintStatus).not.toBe("MINT_CONFIRMED");
  });

  it("fails fast when the backend lacks MINTER_ROLE", async () => {
    gateway.state.minterRole = [];
    await expect(
      claimNft(repository, gateway, trainerId, monsterId),
    ).rejects.toThrow(/MINTER_ROLE/);
    const monster = await repository.getMonster(monsterId);
    expect(monster?.mintStatus).toBe("MINT_FAILED");
  });
});

describe("claimNft — lookup helpers", () => {
  it("exposes isGameMonsterMinted and token lookup after claim", async () => {
    await claimNft(repository, gateway, trainerId, monsterId);
    expect(
      await gateway.isGameMonsterMinted(hashGameMonsterId(monsterId)),
    ).toBe(true);
    expect(
      await gateway.getTokenIdByGameMonsterId(hashGameMonsterId(monsterId)),
    ).toBe(1n);
  });
});
