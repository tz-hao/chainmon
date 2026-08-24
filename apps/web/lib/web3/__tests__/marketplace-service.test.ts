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
import { FakeChainGateway } from "../fake-gateway";
import { hashGameMonsterId, hashMonsterDNA } from "../hash";
import {
  assertNotListed,
  cancelListing,
  confirmSale,
  getForSaleListings,
  listMonster,
  MarketplaceError,
  reconcileListing,
} from "../../services/marketplace-service";
import {
  syncByWallet,
  syncMonsterOwnership,
} from "../../services/ownership-sync-service";

const WALLET_A = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const WALLET_B = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
);

const TX = "0xef00000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;
const PRICE_WEI = "10000000000000000"; // 0.01 ETH

let repository: GameRepository;
let gateway: FakeChainGateway;
let trainerA: { id: string };
let monsterId: string;

/** Trainer A owns a minted FireCub NFT (wallet A verified). */
async function setupMintedMonster() {
  resetMemoryRepository();
  resetRandomSource();
  repository = memoryRepository;
  gateway = new FakeChainGateway();

  const { trainer } = await createTrainerWithStarter(
    repository,
    "Ash",
    "firecub",
  );
  trainerA = { id: trainer.id };
  await repository.bindWallet(trainer.id, WALLET_A.address);

  const fireCub = getSpeciesBySlug("firecub")!;
  const monster = generateMonster(fireCub, { owner: trainer.id });
  await repository.addMonster(monster);
  monsterId = monster.id;

  await gateway.mintMonster(WALLET_A.address.toLowerCase() as `0x${string}`, {
    gameMonsterIdHash: hashGameMonsterId(monster.id),
    speciesId: fireCub.id,
    generation: 1,
    rarity: 0,
    evolutionStage: 0,
    dnaHash: hashMonsterDNA(monster.dna),
  });
  await repository.setMintConfirmed(monster.id, "1", WALLET_A.address.toLowerCase());
  return { trainer, monster };
}

beforeEach(async () => {
  await setupMintedMonster();
});

describe("listing eligibility", () => {
  it("rejects OFFCHAIN monsters", async () => {
    const offchain = generateMonster(getSpeciesBySlug("leafcat")!, {
      owner: trainerA.id,
    });
    await repository.addMonster(offchain);
    await expect(
      listMonster(repository, gateway, trainerA.id, offchain.id, TX, PRICE_WEI),
    ).rejects.toThrow(/Claim NFT before selling/);
  });

  it("rejects monsters the trainer does not own", async () => {
    await expect(
      listMonster(repository, gateway, "someone-else", monsterId, TX, PRICE_WEI),
    ).rejects.toThrow(/don't own/);
  });

  it("rejects when the on-chain owner differs from the verified wallet", async () => {
    gateway.state.owners.set(1n, WALLET_B.address.toLowerCase() as `0x${string}`);
    await expect(
      listMonster(repository, gateway, trainerA.id, monsterId, TX, PRICE_WEI),
    ).rejects.toThrow(/on-chain/i);
  });
});

describe("listMonster state machine", () => {
  it("rejects a tx hash whose calldata names a different marketplace method", async () => {
    gateway.submitMarketplaceTransaction(
      "buyMonster",
      1n,
      WALLET_A.address.toLowerCase() as `0x${string}`,
      BigInt(PRICE_WEI),
    );
    await expect(
      listMonster(repository, gateway, trainerA.id, monsterId, TX, PRICE_WEI),
    ).rejects.toThrow(/calldata/i);
    expect(await repository.getListingByMonster(monsterId)).toBeNull();
  });

  it("rejects a tx hash sent by another wallet", async () => {
    gateway.submitMarketplaceTransaction(
      "listMonster",
      1n,
      WALLET_B.address.toLowerCase() as `0x${string}`,
      BigInt(PRICE_WEI),
    );
    await expect(
      listMonster(repository, gateway, trainerA.id, monsterId, TX, PRICE_WEI),
    ).rejects.toThrow(/sender/i);
  });

  it("rejects a success receipt that omits the expected listing event", async () => {
    gateway.submitMarketplaceTransaction(
      "listMonster",
      1n,
      WALLET_A.address.toLowerCase() as `0x${string}`,
      BigInt(PRICE_WEI),
    );
    gateway.marketplaceReceipts.set(TX, { status: "success", blockNumber: 1n, logs: [] });
    await expect(
      listMonster(repository, gateway, trainerA.id, monsterId, TX, PRICE_WEI),
    ).rejects.toThrow(/expected marketplace event/i);
  });

  it("lists PENDING → receipt → ACTIVE (chain listing verified)", async () => {
    gateway.setNftApproval(1n, gateway.marketplaceAddress);
    await gateway.listOnMarketplace(1n, BigInt(PRICE_WEI));

    const listing = await listMonster(
      repository,
      gateway,
      trainerA.id,
      monsterId,
      TX,
      PRICE_WEI,
    );
    expect(listing.status).toBe("ACTIVE");
    expect(listing.priceWei).toBe(PRICE_WEI);
    expect(listing.tokenId).toBe("1");
    expect(listing.sellerId).toBe(trainerA.id);
  });

  it("keeps PENDING while the receipt is not mined", async () => {
    gateway.marketplaceTxResult = "pending";
    gateway.submitMarketplaceTransaction(
      "listMonster",
      1n,
      WALLET_A.address.toLowerCase() as `0x${string}`,
      BigInt(PRICE_WEI),
    );
    const listing = await listMonster(
      repository,
      gateway,
      trainerA.id,
      monsterId,
      TX,
      PRICE_WEI,
    );
    expect(listing.status).toBe("PENDING");
  });

  it("marks FAILED when the list transaction reverts", async () => {
    gateway.marketplaceTxResult = "reverted";
    gateway.submitMarketplaceTransaction(
      "listMonster",
      1n,
      WALLET_A.address.toLowerCase() as `0x${string}`,
      BigInt(PRICE_WEI),
    );
    const listing = await listMonster(
      repository,
      gateway,
      trainerA.id,
      monsterId,
      TX,
      PRICE_WEI,
    );
    expect(listing.status).toBe("FAILED");
  });

  it("marks STALE when the chain listing is inactive after a success receipt", async () => {
    gateway.marketplaceTxResult = "success";
    gateway.submitMarketplaceTransaction(
      "listMonster",
      1n,
      WALLET_A.address.toLowerCase() as `0x${string}`,
      BigInt(PRICE_WEI),
    );
    // No on-chain listing exists (user cancelled it before confirming)
    const listing = await listMonster(
      repository,
      gateway,
      trainerA.id,
      monsterId,
      TX,
      PRICE_WEI,
    );
    expect(listing.status).toBe("STALE");
  });
});

describe("cancelListing", () => {
  it("cancels an ACTIVE listing", async () => {
    gateway.setNftApproval(1n, gateway.marketplaceAddress);
    await gateway.listOnMarketplace(1n, BigInt(PRICE_WEI));
    await listMonster(repository, gateway, trainerA.id, monsterId, TX, PRICE_WEI);
    await gateway.cancelOnMarketplace(1n);

    const cancelled = await cancelListing(
      repository,
      gateway,
      trainerA.id,
      monsterId,
      TX,
    );
    expect(cancelled.status).toBe("CANCELLED");
    expect((await repository.getListingByMonster(monsterId))?.status).toBe("CANCELLED");
  });

  it("rejects cancels by a non-seller", async () => {
    gateway.setNftApproval(1n, gateway.marketplaceAddress);
    await gateway.listOnMarketplace(1n, BigInt(PRICE_WEI));
    await listMonster(repository, gateway, trainerA.id, monsterId, TX, PRICE_WEI);

    await expect(
      cancelListing(repository, gateway, "someone-else", monsterId, TX),
    ).rejects.toThrow(/your own/);
  });
});

describe("confirmSale + ownership sync", () => {
  async function createActiveListing() {
    gateway.setNftApproval(1n, gateway.marketplaceAddress);
    await gateway.listOnMarketplace(1n, BigInt(PRICE_WEI));
    return listMonster(repository, gateway, trainerA.id, monsterId, TX, PRICE_WEI);
  }

  it("sells: SALE_PENDING → SOLD + monster moves to the buyer collection with full data", async () => {
    await createActiveListing();

    // Buyer B buys on-chain (user wallet) — simulated second trainer
    const trainerBId = "trainer-b";
    setMemoryWalletOwnerForTest(WALLET_B.address, trainerBId);

    const before = await repository.getMonster(monsterId);
    expect(before).not.toBeNull();

    // Buy on chain (fake): NFT moves to B
    await gateway.buyOnMarketplace(1n, WALLET_B.address.toLowerCase() as `0x${string}`, BigInt(PRICE_WEI));

    const sold = await confirmSale(
      repository,
      gateway,
      trainerBId,
      monsterId,
      TX,
      WALLET_B.address,
    );
    expect(sold.status).toBe("SOLD");

    // Seller collection no longer contains it; buyer collection does.
    const sellerMonsters = await repository.listMonsters();
    expect(sellerMonsters.find((m) => m.id === monsterId)).toBeUndefined();

    // Ownership moved to trainer B (via wallet → trainer mapping)
    const after = await repository.getMonster(monsterId);
    expect(after).not.toBeNull();
    expect(after?.owner).toBe(trainerBId);
    expect(after?.onchainOwnerAddress).toBe(WALLET_B.address.toLowerCase());
  });

  it("rejects when the buyer wallet is not the trainer's verified wallet", async () => {
    await createActiveListing();
    await expect(
      confirmSale(repository, gateway, trainerA.id, monsterId, TX, WALLET_B.address),
    ).rejects.toThrow(/verified wallet/);
  });
});

describe("data preservation across sale", () => {
  it("keeps DNA, stats, history and identity unchanged after transfer", async () => {
    gateway.setNftApproval(1n, gateway.marketplaceAddress);
    await gateway.listOnMarketplace(1n, BigInt(PRICE_WEI));
    await listMonster(repository, gateway, trainerA.id, monsterId, TX, PRICE_WEI);

    const second = await createTrainerWithStarter(repository, "Misty", "leafcat");
    void second;
    const trainerBId = "trainer-b";
    setMemoryWalletOwnerForTest(WALLET_B.address, trainerBId);

    const before = await repository.getMonster(monsterId);
    if (!before) throw new Error("fixture");

    // Simulate some battle history before the sale
    before.battleCount = 12;
    before.wins = 9;

    await gateway.buyOnMarketplace(1n, WALLET_B.address.toLowerCase() as `0x${string}`, BigInt(PRICE_WEI));
    await confirmSale(repository, gateway, trainerBId, monsterId, TX, WALLET_B.address);

    const after = await repository.getMonster(monsterId);
    if (!after) throw new Error("sold monster missing");
    expect(after.dna).toEqual(before.dna);
    expect(after.generation).toBe(before.generation);
    expect(after.level).toBe(before.level);
    expect(after.exp).toBe(before.exp);
    expect(after.hp).toBe(before.hp);
    expect(after.attack).toBe(before.attack);
    expect(after.defense).toBe(before.defense);
    expect(after.speed).toBe(before.speed);
    expect(after.skills).toEqual(before.skills);
    expect(after.battleCount).toBe(12);
    expect(after.wins).toBe(9);
    expect(after.tokenId).toBe(before.tokenId);
  });
});

describe("ownership sync", () => {
  it("external owner: no ChainMon trainer → owner null + onchain address kept", async () => {
    // Transfer NFT directly to an unbound wallet C
    const walletC = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc";
    gateway.state.owners.set(1n, walletC as `0x${string}`);

    const result = await syncMonsterOwnership(repository, gateway, monsterId);
    expect(result.owner).toBeNull();
    expect(result.onchainOwner).toBe(walletC);

    const monster = await repository.getMonster(monsterId);
    expect(monster?.owner).toBeNull();
    expect(monster?.onchainOwnerAddress).toBe(walletC);
  });

  it("wallet binding recovery: syncByWallet returns assets to the new trainer", async () => {
    const walletC = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc";
    gateway.state.owners.set(1n, walletC as `0x${string}`);
    await syncMonsterOwnership(repository, gateway, monsterId);

    // Trainer C binds wallet C later → assets return without re-minting
    const trainerCId = "trainer-c";
    setMemoryWalletOwnerForTest(walletC, trainerCId);

    const changed = await syncByWallet(repository, gateway, walletC);
    expect(changed).toBeGreaterThan(0);
    const monster = await repository.getMonster(monsterId);
    expect(monster?.owner).toBe(trainerCId);
  });

  it("direct transfer sync: ownerOf change moves the monster to the new trainer", async () => {
    const trainerBId = "trainer-b";
    setMemoryWalletOwnerForTest(WALLET_B.address, trainerBId);

    gateway.state.owners.set(1n, WALLET_B.address.toLowerCase() as `0x${string}`);
    await syncMonsterOwnership(repository, gateway, monsterId);

    const monster = await repository.getMonster(monsterId);
    expect(monster?.owner).toBe(trainerBId);
  });
});

describe("marketplace lock & reconciliation", () => {
  it("assertNotListed rejects when an ACTIVE listing exists", async () => {
    gateway.setNftApproval(1n, gateway.marketplaceAddress);
    await gateway.listOnMarketplace(1n, BigInt(PRICE_WEI));
    await listMonster(repository, gateway, trainerA.id, monsterId, TX, PRICE_WEI);

    await expect(assertNotListed(repository, monsterId)).rejects.toThrow(
      /listed for sale/,
    );
  });

  it("reconcile marks STALE when the chain listing disappeared", async () => {
    gateway.setNftApproval(1n, gateway.marketplaceAddress);
    await gateway.listOnMarketplace(1n, BigInt(PRICE_WEI));
    await listMonster(repository, gateway, trainerA.id, monsterId, TX, PRICE_WEI);

    // Seller transferred the NFT directly → chain listing still "active" in
    // our fake, but owner changed; simulate by clearing the chain listing.
    gateway.marketplaceListings.delete(1n);

    const listing = await reconcileListing(repository, gateway, monsterId);
    expect(listing?.status).toBe("STALE");
  });

  it("getForSaleListings returns only ACTIVE listings", async () => {
    gateway.setNftApproval(1n, gateway.marketplaceAddress);
    await gateway.listOnMarketplace(1n, BigInt(PRICE_WEI));
    await listMonster(repository, gateway, trainerA.id, monsterId, TX, PRICE_WEI);

    const listings = await getForSaleListings(repository, gateway);
    expect(listings).toHaveLength(1);
    expect(listings[0]?.status).toBe("ACTIVE");
    expect(listings[0]?.monster.id).toBe(monsterId);
  });
});
