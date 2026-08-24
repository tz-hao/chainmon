import { expect } from "chai";
import { parseEther } from "ethers";
import type { Signer } from "ethers";
import { ethers } from "hardhat";
import {
  buildMonsterMintPayload,
  hashGameMonsterId,
  hashMonsterDNA,
} from "../scripts/hash-helpers";
import { getEvolutionStage, getSpeciesBySlug } from "@chainmon/monster-data";

const DNA = {
  hpGene: 63,
  attackGene: 77,
  defenseGene: 41,
  speedGene: 88,
  mutationGene: 12,
};

const PRICE = parseEther("0.01");

describe("MonsterMarketplace", function () {
  let nft: any;
  let marketplace: any;
  let deployer: Signer;
  let seller: Signer;
  let buyer: Signer;
  let other: Signer;

  async function addressOf(signer: Signer) {
    return signer.getAddress();
  }

  async function mintTo(recipient: Signer, id?: string) {
    const fireCub = getSpeciesBySlug("firecub")!;
    const gameId =
      id ?? `market-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const payload = buildMonsterMintPayload(
      {
        id: gameId,
        speciesId: fireCub.id,
        name: fireCub.name,
        element: fireCub.element,
        rarity: fireCub.rarity,
        level: 1,
        exp: 0,
        hp: 60,
        attack: 73,
        defense: 40,
        speed: 50,
        skills: [],
        owner: await addressOf(recipient),
        generation: 1,
        battleCount: 0,
        wins: 0,
        dna: DNA,
      },
      fireCub,
      getEvolutionStage(fireCub),
    );
    await (await nft.mintMonster(await addressOf(recipient), payload)).wait();
    return 1n;
  }

  beforeEach(async function () {
    [deployer, seller, buyer, other] = await ethers.getSigners();

    const nftFactory = await ethers.getContractFactory("MonsterNFT");
    nft = await nftFactory.deploy(
      "ChainMon Monsters",
      "CMON",
      "https://api.chainmon.game/metadata/",
      await addressOf(deployer),
    );
    await nft.waitForDeployment();

    const mpFactory = await ethers.getContractFactory("MonsterMarketplace");
    marketplace = await mpFactory.deploy(
      await nft.getAddress(),
      await addressOf(deployer),
    );
    await marketplace.waitForDeployment();
  });

  async function listedToken(price = PRICE) {
    const tokenId = await mintTo(seller);
    await (
      await nft.connect(seller).approve(await marketplace.getAddress(), tokenId)
    ).wait();
    await (await marketplace.connect(seller).listMonster(tokenId, price)).wait();
    return tokenId;
  }

  // ----------------------------------------------------------------
  // Deployment
  // ----------------------------------------------------------------
  it("deploys with the monster NFT address, admin and version", async function () {
    expect(await marketplace.monsterNFT()).to.equal(await nft.getAddress());
    expect(await marketplace.CONTRACT_VERSION()).to.equal("1.0.0");
    expect(
      await marketplace.hasRole(await marketplace.DEFAULT_ADMIN_ROLE(), await addressOf(deployer)),
    ).to.equal(true);
  });

  it("rejects a zero NFT address", async function () {
    const factory = await ethers.getContractFactory("MonsterMarketplace");
    await expect(
      factory.deploy(ethers.ZeroAddress, await addressOf(deployer)),
    ).to.be.revertedWithCustomError(factory, "InvalidMonsterNFT");
  });

  // ----------------------------------------------------------------
  // List
  // ----------------------------------------------------------------
  it("lists a monster after approval (happy path)", async function () {
    const tokenId = await listedToken();
    const listing = await marketplace.getListing(tokenId);
    expect(listing.seller).to.equal(await addressOf(seller));
    expect(listing.price).to.equal(PRICE);
    expect(listing.active).to.equal(true);
    expect(listing.tokenId).to.equal(tokenId);
  });

  it("reverts on zero price", async function () {
    const tokenId = await mintTo(seller);
    await (
      await nft.connect(seller).approve(await marketplace.getAddress(), tokenId)
    ).wait();
    await expect(
      marketplace.connect(seller).listMonster(tokenId, 0),
    ).to.be.revertedWithCustomError(marketplace, "InvalidPrice");
  });

  it("reverts when a non-owner tries to list", async function () {
    const tokenId = await mintTo(seller);
    await (
      await nft.connect(seller).approve(await marketplace.getAddress(), tokenId)
    ).wait();
    await expect(
      marketplace.connect(other).listMonster(tokenId, PRICE),
    ).to.be.revertedWithCustomError(marketplace, "NotMonsterOwner");
  });

  it("reverts when the marketplace is not approved", async function () {
    const tokenId = await mintTo(seller); // no approval
    await expect(
      marketplace.connect(seller).listMonster(tokenId, PRICE),
    ).to.be.revertedWithCustomError(marketplace, "MarketplaceNotApproved");
  });

  it("accepts setApprovalForAll as valid approval", async function () {
    const tokenId = await mintTo(seller);
    await (
      await nft
        .connect(seller)
        .setApprovalForAll(await marketplace.getAddress(), true)
    ).wait();
    await (await marketplace.connect(seller).listMonster(tokenId, PRICE)).wait();
    const listing = await marketplace.getListing(tokenId);
    expect(listing.active).to.equal(true);
  });

  it("reverts on a duplicate active listing", async function () {
    const tokenId = await listedToken();
    await expect(
      marketplace.connect(seller).listMonster(tokenId, PRICE),
    ).to.be.revertedWithCustomError(marketplace, "AlreadyListed");
  });

  it("emits MonsterListed with tokenId, seller and price", async function () {
    const tokenId = await mintTo(seller);
    await (
      await nft.connect(seller).approve(await marketplace.getAddress(), tokenId)
    ).wait();
    await expect(marketplace.connect(seller).listMonster(tokenId, PRICE))
      .to.emit(marketplace, "MonsterListed")
      .withArgs(tokenId, await addressOf(seller), PRICE);
  });

  // ----------------------------------------------------------------
  // Cancel
  // ----------------------------------------------------------------
  it("lets the seller cancel an active listing", async function () {
    const tokenId = await listedToken();
    await expect(marketplace.connect(seller).cancelListing(tokenId))
      .to.emit(marketplace, "ListingCancelled")
      .withArgs(tokenId, await addressOf(seller));
    expect((await marketplace.getListing(tokenId)).active).to.equal(false);
  });

  it("reverts when a non-seller tries to cancel", async function () {
    const tokenId = await listedToken();
    await expect(
      marketplace.connect(other).cancelListing(tokenId),
    ).to.be.revertedWithCustomError(marketplace, "NotListingSeller");
  });

  it("reverts when cancelling an inactive listing", async function () {
    const tokenId = await listedToken();
    await (await marketplace.connect(seller).cancelListing(tokenId)).wait();
    await expect(
      marketplace.connect(seller).cancelListing(tokenId),
    ).to.be.revertedWithCustomError(marketplace, "ListingNotActive");
  });

  // ----------------------------------------------------------------
  // Buy
  // ----------------------------------------------------------------
  it("sells the NFT, settles ETH to the seller and keeps no balance", async function () {
    const tokenId = await listedToken();
    const sellerBefore = await ethers.provider.getBalance(await addressOf(seller));

    await expect(
      marketplace.connect(buyer).buyMonster(tokenId, { value: PRICE }),
    )
      .to.emit(marketplace, "MonsterSold")
      .withArgs(tokenId, await addressOf(seller), await addressOf(buyer), PRICE);

    expect(await nft.ownerOf(tokenId)).to.equal(await addressOf(buyer));
    expect((await marketplace.getListing(tokenId)).active).to.equal(false);

    const sellerAfter = await ethers.provider.getBalance(await addressOf(seller));
    // Gas cost of the seller's list tx already paid; the buy settles exactly PRICE.
    expect(sellerAfter - sellerBefore).to.equal(PRICE);
    expect(await ethers.provider.getBalance(await marketplace.getAddress())).to.equal(0n);
  });

  it("reverts when the seller buys their own listing", async function () {
    const tokenId = await listedToken();
    await expect(
      marketplace.connect(seller).buyMonster(tokenId, { value: PRICE }),
    ).to.be.revertedWithCustomError(marketplace, "CannotBuyOwnMonster");
  });

  it("reverts on underpayment", async function () {
    const tokenId = await listedToken();
    await expect(
      marketplace.connect(buyer).buyMonster(tokenId, {
        value: PRICE - 1n,
      }),
    ).to.be.revertedWithCustomError(marketplace, "IncorrectPayment");
  });

  it("reverts on overpayment", async function () {
    const tokenId = await listedToken();
    await expect(
      marketplace.connect(buyer).buyMonster(tokenId, {
        value: PRICE + 1n,
      }),
    ).to.be.revertedWithCustomError(marketplace, "IncorrectPayment");
  });

  it("reverts when buying without an active listing", async function () {
    const tokenId = await mintTo(seller);
    await expect(
      marketplace.connect(buyer).buyMonster(tokenId, { value: PRICE }),
    ).to.be.revertedWithCustomError(marketplace, "ListingNotActive");
  });

  it("reverts when buying a cancelled listing", async function () {
    const tokenId = await listedToken();
    await (await marketplace.connect(seller).cancelListing(tokenId)).wait();
    await expect(
      marketplace.connect(buyer).buyMonster(tokenId, { value: PRICE }),
    ).to.be.revertedWithCustomError(marketplace, "ListingNotActive");
  });

  it("reverts when buying an already-sold listing", async function () {
    const tokenId = await listedToken();
    await (
      await marketplace.connect(buyer).buyMonster(tokenId, { value: PRICE })
    ).wait();
    await expect(
      marketplace.connect(other).buyMonster(tokenId, { value: PRICE }),
    ).to.be.revertedWithCustomError(marketplace, "ListingNotActive");
  });

  it("reverts when the seller transferred the NFT away before the buy", async function () {
    const tokenId = await listedToken();
    // Seller transfers the NFT directly to `other` (non-custodial risk)
    await (
      await nft
        .connect(seller)
        .safeTransferFrom(await addressOf(seller), await addressOf(other), tokenId)
    ).wait();

    await expect(
      marketplace.connect(buyer).buyMonster(tokenId, { value: PRICE }),
    ).to.be.revertedWithCustomError(marketplace, "SellerNoLongerOwner");

    // Seller never received ETH
    expect(await ethers.provider.getBalance(await marketplace.getAddress())).to.equal(0n);
  });

  it("reverts when the seller revoked approval before the buy", async function () {
    const tokenId = await listedToken();
    await (await nft.connect(seller).approve(ethers.ZeroAddress, tokenId)).wait();

    await expect(
      marketplace.connect(buyer).buyMonster(tokenId, { value: PRICE }),
    ).to.be.revertedWithCustomError(marketplace, "MarketplaceNotApproved");

    // Buyer's ETH is not lost (whole tx reverted)
    const listing = await marketplace.getListing(tokenId);
    expect(listing.active).to.equal(true);
    expect(await ethers.provider.getBalance(await marketplace.getAddress())).to.equal(0n);
  });

  it("lets only one buyer win a race (second buy fails)", async function () {
    const tokenId = await listedToken();
    await (
      await marketplace.connect(buyer).buyMonster(tokenId, { value: PRICE })
    ).wait();

    await expect(
      marketplace.connect(other).buyMonster(tokenId, { value: PRICE }),
    ).to.be.revertedWithCustomError(marketplace, "ListingNotActive");
    expect(await nft.ownerOf(tokenId)).to.equal(await addressOf(buyer));
  });

  it("blocks a reentrant buy attempt from a malicious seller contract", async function () {
    const tokenId = await mintTo(seller);
    await (
      await nft.connect(seller).approve(await marketplace.getAddress(), tokenId)
    ).wait();
    await (await marketplace.connect(seller).listMonster(tokenId, PRICE)).wait();

    // Deploy the malicious buyer contract and transfer the NFT to it,
    // then re-list from the contract (it owns the NFT).
    const malFactory = await ethers.getContractFactory("MaliciousBuyer");
    const malicious = await malFactory.deploy(await marketplace.getAddress());
    await (
      await nft
        .connect(seller)
        .safeTransferFrom(await addressOf(seller), await malicious.getAddress(), tokenId)
    ).wait();
    // Listing key is the token id — the old listing is inactive now.
    await (await marketplace.connect(seller).cancelListing(tokenId)).wait();
    await (
      await malicious.approveNft(await nft.getAddress(), tokenId)
    ).wait();
    await (await malicious.list(tokenId, PRICE)).wait();

    // The malicious seller's receive() tries to re-enter buyMonster during
    // ETH settlement. ReentrancyGuard blocks the re-entry; the outer
    // transaction completes atomically (NFT + exactly one settlement).
    await (
      await marketplace.connect(buyer).buyMonster(tokenId, { value: PRICE })
    ).wait();
    expect(await nft.ownerOf(tokenId)).to.equal(await addressOf(buyer));
    expect(await ethers.provider.getBalance(await marketplace.getAddress())).to.equal(0n);
    // The malicious contract received exactly one payment (no double-settle).
    expect(await ethers.provider.getBalance(await malicious.getAddress())).to.equal(PRICE);
  });

  // ----------------------------------------------------------------
  // Pause
  // ----------------------------------------------------------------
  it("rejects list and buy while paused but allows cancel", async function () {
    const tokenId = await listedToken();
    await (await marketplace.pause()).wait();

    const otherToken = await mintTo(seller);
    await (
      await nft.connect(seller).approve(await marketplace.getAddress(), otherToken)
    ).wait();
    await expect(
      marketplace.connect(seller).listMonster(otherToken, PRICE),
    ).to.be.reverted;
    await expect(
      marketplace.connect(buyer).buyMonster(tokenId, { value: PRICE }),
    ).to.be.reverted;

    // Cancel stays available while paused (emergency rule).
    await (await marketplace.connect(seller).cancelListing(tokenId)).wait();
    expect((await marketplace.getListing(tokenId)).active).to.equal(false);
  });

  it("restores list and buy after unpause", async function () {
    await (await marketplace.pause()).wait();
    await (await marketplace.unpause()).wait();

    const tokenId = await mintTo(seller);
    await (
      await nft.connect(seller).approve(await marketplace.getAddress(), tokenId)
    ).wait();
    await (await marketplace.connect(seller).listMonster(tokenId, PRICE)).wait();
    await (
      await marketplace.connect(buyer).buyMonster(tokenId, { value: PRICE })
    ).wait();
    expect(await nft.ownerOf(tokenId)).to.equal(await addressOf(buyer));
  });

  it("rejects pause by a non-admin", async function () {
    await expect(marketplace.connect(other).pause()).to.be.reverted;
  });

  // ----------------------------------------------------------------
  // Payment atomicity
  // ----------------------------------------------------------------
  it("never transfers the NFT without paying the seller (revert path)", async function () {
    const tokenId = await listedToken();
    // Revoke approval → buy reverts → NFT stays with the seller and the
    // listing remains active (whole tx atomic).
    await (await nft.connect(seller).approve(ethers.ZeroAddress, tokenId)).wait();
    await expect(
      marketplace.connect(buyer).buyMonster(tokenId, { value: PRICE }),
    ).to.be.reverted;

    expect(await nft.ownerOf(tokenId)).to.equal(await addressOf(seller));
    expect((await marketplace.getListing(tokenId)).active).to.equal(true);
  });

  it("exposes getListing for unlisted tokens as inactive", async function () {
    const listing = await marketplace.getListing(999n);
    expect(listing.active).to.equal(false);
    expect(listing.seller).to.equal(ethers.ZeroAddress);
  });
});
