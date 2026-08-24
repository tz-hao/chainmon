import { expect } from "chai";
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

const BASE_URI = "https://api.chainmon.game/metadata/";

describe("MonsterNFT", function () {
  let nft: any;
  let deployer: Signer;
  let minter: Signer;
  let evolver: Signer;
  let playerA: Signer;
  let playerB: Signer;
  let stranger: Signer;

  async function addressOf(signer: Signer): Promise<string> {
    return signer.getAddress();
  }

  function payload(overrides: Record<string, unknown> = {}) {
    return {
      gameMonsterIdHash: hashGameMonsterId("monster-abc"),
      speciesId: 1, // FireCub
      generation: 1,
      rarity: 0, // Common
      evolutionStage: 0,
      dnaHash: hashMonsterDNA(DNA),
      ...overrides,
    };
  }

  beforeEach(async function () {
    [deployer, minter, evolver, playerA, playerB, stranger] =
      await ethers.getSigners();
    const factory = await ethers.getContractFactory("MonsterNFT");
    nft = await factory.deploy(
      "ChainMon Monsters",
      "CMON",
      BASE_URI,
      await addressOf(deployer),
    );
    await nft.waitForDeployment();
  });

  // ------------------------------------------------------------------
  // Deployment & roles
  // ------------------------------------------------------------------
  it("deploys with name, symbol and contract version", async function () {
    expect(await nft.name()).to.equal("ChainMon Monsters");
    expect(await nft.symbol()).to.equal("CMON");
    expect(await nft.CONTRACT_VERSION()).to.equal("1.0.0");
  });

  it("grants DEFAULT_ADMIN, MINTER and EVOLVER roles to the deployer", async function () {
    const deployerAddr = await addressOf(deployer);
    expect(await nft.hasRole(await nft.DEFAULT_ADMIN_ROLE(), deployerAddr)).to.equal(true);
    expect(await nft.hasRole(await nft.MINTER_ROLE(), deployerAddr)).to.equal(true);
    expect(await nft.hasRole(await nft.EVOLVER_ROLE(), deployerAddr)).to.equal(true);
  });

  it("rejects a zero-address admin", async function () {
    const factory = await ethers.getContractFactory("MonsterNFT");
    await expect(
      factory.deploy(
        "ChainMon Monsters",
        "CMON",
        BASE_URI,
        ethers.ZeroAddress,
      ),
    ).to.be.revertedWithCustomError(factory, "InvalidAdmin");
  });

  it("lets an admin grant the minter role to a backend and revoke it", async function () {
    const minterAddr = await addressOf(minter);
    const role = await nft.MINTER_ROLE();
    await nft.grantRole(role, minterAddr);
    expect(await nft.hasRole(role, minterAddr)).to.equal(true);

    await nft.connect(minter).mintMonster(await addressOf(playerA), payload());
    expect(await nft.ownerOf(1)).to.equal(await addressOf(playerA));

    await nft.revokeRole(role, minterAddr);
    await expect(
      nft.connect(minter).mintMonster(await addressOf(playerA), payload()),
    ).to.be.reverted;
  });

  it("rejects minting by an unauthorized wallet", async function () {
    await expect(
      nft.connect(stranger).mintMonster(await addressOf(playerA), payload()),
    ).to.be.reverted;
  });

  // ------------------------------------------------------------------
  // Mint
  // ------------------------------------------------------------------
  it("mints token #1 to the recipient", async function () {
    const tx = await nft.mintMonster(await addressOf(playerA), payload());
    await tx.wait();
    expect(await nft.ownerOf(1)).to.equal(await addressOf(playerA));
  });

  it("stores the full monster data exactly as minted", async function () {
    await (await nft.mintMonster(await addressOf(playerA), payload())).wait();
    const data = await nft.getMonster(1);
    expect(data.speciesId).to.equal(1n);
    expect(data.generation).to.equal(1n);
    expect(data.rarity).to.equal(0n);
    expect(data.evolutionStage).to.equal(0n);
    expect(data.dnaHash).to.equal(payload().dnaHash);
    expect(data.gameMonsterIdHash).to.equal(payload().gameMonsterIdHash);
  });

  it("assigns sequential token ids (1, 2, 3)", async function () {
    const p = await addressOf(playerA);
    await (await nft.mintMonster(p, payload({ gameMonsterIdHash: hashGameMonsterId("m-1") }))).wait();
    await (await nft.mintMonster(p, payload({ gameMonsterIdHash: hashGameMonsterId("m-2") }))).wait();
    await (await nft.mintMonster(p, payload({ gameMonsterIdHash: hashGameMonsterId("m-3") }))).wait();
    expect(await nft.ownerOf(1)).to.equal(p);
    expect(await nft.ownerOf(2)).to.equal(p);
    expect(await nft.ownerOf(3)).to.equal(p);
  });

  it("reverts on duplicate game monster ids (even with different payloads)", async function () {
    const p = await addressOf(playerA);
    await (await nft.mintMonster(p, payload())).wait();
    await expect(
      nft.mintMonster(
        await addressOf(playerB),
        payload({
          speciesId: 10, // AbyssShark
          dnaHash: hashMonsterDNA({ ...DNA, hpGene: 99 }),
        }),
      ),
    ).to.be.revertedWithCustomError(nft, "GameMonsterAlreadyMinted");
  });

  it("reverts when minting to the zero address", async function () {
    await expect(nft.mintMonster(ethers.ZeroAddress, payload())).to.be.reverted;
  });

  it("reverts on a zero game monster id", async function () {
    await expect(
      nft.mintMonster(await addressOf(playerA), payload({ gameMonsterIdHash: ethers.ZeroHash })),
    ).to.be.revertedWithCustomError(nft, "InvalidGameMonsterId");
  });

  it("reverts on a zero dna hash", async function () {
    await expect(
      nft.mintMonster(await addressOf(playerA), payload({ dnaHash: ethers.ZeroHash })),
    ).to.be.revertedWithCustomError(nft, "InvalidDNAHash");
  });

  it("reverts on species id 0", async function () {
    await expect(
      nft.mintMonster(await addressOf(playerA), payload({ speciesId: 0 })),
    ).to.be.revertedWithCustomError(nft, "InvalidSpecies");
  });

  it("reverts on generation 0", async function () {
    await expect(
      nft.mintMonster(await addressOf(playerA), payload({ generation: 0 })),
    ).to.be.revertedWithCustomError(nft, "InvalidGeneration");
  });

  it("reverts on an out-of-range rarity (4)", async function () {
    await expect(
      nft.mintMonster(await addressOf(playerA), payload({ rarity: 4 })),
    ).to.be.revertedWithCustomError(nft, "InvalidRarity");
  });

  it("reverts on an out-of-range evolution stage (3)", async function () {
    await expect(
      nft.mintMonster(await addressOf(playerA), payload({ evolutionStage: 3 })),
    ).to.be.revertedWithCustomError(nft, "InvalidEvolutionStage");
  });

  it("emits MonsterMinted with all fields", async function () {
    const p = await addressOf(playerA);
    const input = payload();
    await expect(nft.mintMonster(p, input))
      .to.emit(nft, "MonsterMinted")
      .withArgs(1, p, input.gameMonsterIdHash, 1, 1, 0, 0, input.dnaHash);
  });

  // ------------------------------------------------------------------
  // Lookups
  // ------------------------------------------------------------------
  it("supports game-id lookups and reports unminted ids", async function () {
    const input = payload();
    expect(await nft.getTokenIdByGameMonsterIdHash(input.gameMonsterIdHash)).to.equal(0n);
    expect(await nft.isGameMonsterMinted(input.gameMonsterIdHash)).to.equal(false);

    await (await nft.mintMonster(await addressOf(playerA), input)).wait();

    expect(await nft.getTokenIdByGameMonsterIdHash(input.gameMonsterIdHash)).to.equal(1n);
    expect(await nft.isGameMonsterMinted(input.gameMonsterIdHash)).to.equal(true);
    expect(await nft.getTokenIdByGameMonsterIdHash(hashGameMonsterId("nope"))).to.equal(0n);
    expect(await nft.isGameMonsterMinted(hashGameMonsterId("nope"))).to.equal(false);
  });

  it("reverts getMonster for a token that does not exist", async function () {
    await expect(nft.getMonster(999999)).to.be.revertedWithCustomError(
      nft,
      "TokenDoesNotExist",
    );
  });

  // ------------------------------------------------------------------
  // Transfer
  // ------------------------------------------------------------------
  it("transfers ownership via safeTransferFrom", async function () {
    const a = await addressOf(playerA);
    const b = await addressOf(playerB);
    await (await nft.mintMonster(a, payload())).wait();
    await (
      await nft
        .connect(playerA)
        .safeTransferFrom(a, b, 1)
    ).wait();
    expect(await nft.ownerOf(1)).to.equal(b);
  });

  it("keeps monster data identical across transfers", async function () {
    const a = await addressOf(playerA);
    const b = await addressOf(playerB);
    const input = payload();
    await (await nft.mintMonster(a, input)).wait();
    const before = await nft.getMonster(1);
    await (
      await nft.connect(playerA).safeTransferFrom(a, b, 1)
    ).wait();
    const after = await nft.getMonster(1);
    expect(after.dnaHash).to.equal(before.dnaHash);
    expect(after.gameMonsterIdHash).to.equal(before.gameMonsterIdHash);
    expect(after.speciesId).to.equal(before.speciesId);
    expect(after.generation).to.equal(before.generation);
  });

  // ------------------------------------------------------------------
  // Evolution
  // ------------------------------------------------------------------
  it("evolves a monster (species + stage 1) with the authorized role", async function () {
    const a = await addressOf(playerA);
    await (await nft.mintMonster(a, payload())).wait();
    await (await nft.evolveMonster(1, 2, 1)).wait(); // FireCub → FireWolf
    const data = await nft.getMonster(1);
    expect(data.speciesId).to.equal(2n);
    expect(data.evolutionStage).to.equal(1n);
  });

  it("preserves identity across evolution", async function () {
    const a = await addressOf(playerA);
    const input = payload();
    await (await nft.mintMonster(a, input)).wait();
    const before = await nft.getMonster(1);
    await (await nft.evolveMonster(1, 2, 1)).wait();
    const after = await nft.getMonster(1);
    expect(after.dnaHash).to.equal(before.dnaHash);
    expect(after.gameMonsterIdHash).to.equal(before.gameMonsterIdHash);
    expect(after.generation).to.equal(before.generation);
    expect(after.rarity).to.equal(before.rarity);
    expect(await nft.ownerOf(1)).to.equal(a); // token id + owner unchanged
  });

  it("supports a second evolution (stage 1 → 2)", async function () {
    const a = await addressOf(playerA);
    await (await nft.mintMonster(a, payload())).wait();
    await (await nft.evolveMonster(1, 2, 1)).wait();
    await (await nft.evolveMonster(1, 3, 2)).wait(); // FireWolf → InfernoWolf
    const data = await nft.getMonster(1);
    expect(data.speciesId).to.equal(3n);
    expect(data.evolutionStage).to.equal(2n);
  });

  it("reverts when skipping an evolution stage (0 → 2)", async function () {
    const a = await addressOf(playerA);
    await (await nft.mintMonster(a, payload())).wait();
    await expect(
      nft.evolveMonster(1, 3, 2),
    ).to.be.revertedWithCustomError(nft, "InvalidEvolutionStage");
  });

  it("reverts when evolving to the same stage", async function () {
    const a = await addressOf(playerA);
    await (await nft.mintMonster(a, payload())).wait();
    await (await nft.evolveMonster(1, 2, 1)).wait();
    await expect(
      nft.evolveMonster(1, 3, 1),
    ).to.be.revertedWithCustomError(nft, "InvalidEvolutionStage");
  });

  it("reverts when evolving to a lower stage", async function () {
    const a = await addressOf(playerA);
    await (await nft.mintMonster(a, payload())).wait();
    await (await nft.evolveMonster(1, 2, 1)).wait();
    await (await nft.evolveMonster(1, 3, 2)).wait();
    await expect(
      nft.evolveMonster(1, 2, 1),
    ).to.be.revertedWithCustomError(nft, "InvalidEvolutionStage");
  });

  it("reverts when evolving a token that does not exist", async function () {
    await expect(
      nft.evolveMonster(999999, 2, 1),
    ).to.be.revertedWithCustomError(nft, "TokenDoesNotExist");
  });

  it("reverts when evolving to species 0", async function () {
    const a = await addressOf(playerA);
    await (await nft.mintMonster(a, payload())).wait();
    await expect(
      nft.evolveMonster(1, 0, 1),
    ).to.be.revertedWithCustomError(nft, "InvalidSpecies");
  });

  it("rejects evolution by the NFT owner (no EVOLVER_ROLE)", async function () {
    const a = await addressOf(playerA);
    await (await nft.mintMonster(a, payload())).wait();
    await expect(
      nft.connect(playerA).evolveMonster(1, 2, 1),
    ).to.be.reverted; // owner alone cannot evolve
  });

  it("rejects evolution by an unrelated wallet", async function () {
    const a = await addressOf(playerA);
    await (await nft.mintMonster(a, payload())).wait();
    await expect(
      nft.connect(stranger).evolveMonster(1, 2, 1),
    ).to.be.reverted;
  });

  it("emits MonsterEvolved with all fields", async function () {
    const a = await addressOf(playerA);
    await (await nft.mintMonster(a, payload())).wait();
    await expect(nft.evolveMonster(1, 2, 1))
      .to.emit(nft, "MonsterEvolved")
      .withArgs(1, 1, 2, 0, 1);
  });

  // ------------------------------------------------------------------
  // Pause
  // ------------------------------------------------------------------
  it("blocks mint, transfer and evolution while paused", async function () {
    const a = await addressOf(playerA);
    const b = await addressOf(playerB);
    await (await nft.mintMonster(a, payload())).wait();
    await (await nft.pause()).wait();

    await expect(nft.mintMonster(a, payload({ gameMonsterIdHash: hashGameMonsterId("m-2") }))).to.be.reverted;
    await expect(nft.connect(playerA).safeTransferFrom(a, b, 1)).to.be.reverted;
    await expect(nft.evolveMonster(1, 2, 1)).to.be.reverted;
  });

  it("still allows reads while paused", async function () {
    const a = await addressOf(playerA);
    const input = payload();
    await (await nft.mintMonster(a, input)).wait();
    await (await nft.pause()).wait();

    expect(await nft.ownerOf(1)).to.equal(a);
    expect((await nft.getMonster(1)).speciesId).to.equal(1n);
    expect(await nft.isGameMonsterMinted(input.gameMonsterIdHash)).to.equal(true);
  });

  it("restores mint/transfer/evolution after unpause", async function () {
    const a = await addressOf(playerA);
    const b = await addressOf(playerB);
    await (await nft.mintMonster(a, payload())).wait();
    await (await nft.pause()).wait();
    await (await nft.unpause()).wait();

    await (
      await nft.connect(playerA).safeTransferFrom(a, b, 1)
    ).wait();
    expect(await nft.ownerOf(1)).to.equal(b);
    await (await nft.evolveMonster(1, 2, 1)).wait();
    expect((await nft.getMonster(1)).speciesId).to.equal(2n);
  });

  it("rejects pause by a non-admin", async function () {
    await expect(nft.connect(stranger).pause()).to.be.reverted;
  });

  // ------------------------------------------------------------------
  // Metadata
  // ------------------------------------------------------------------
  it("returns tokenURI = baseURI + tokenId", async function () {
    await (await nft.mintMonster(await addressOf(playerA), payload())).wait();
    expect(await nft.tokenURI(1)).to.equal(`${BASE_URI}1`);
  });

  it("updates tokenURI after setBaseURI (admin)", async function () {
    await (await nft.mintMonster(await addressOf(playerA), payload())).wait();
    await (await nft.setBaseURI("https://new.example/metadata/")).wait();
    expect(await nft.tokenURI(1)).to.equal("https://new.example/metadata/1");
  });

  it("emits BaseURIUpdated and rejects non-admin updates", async function () {
    await expect(nft.setBaseURI("https://x.example/"))
      .to.emit(nft, "BaseURIUpdated")
      .withArgs(BASE_URI, "https://x.example/");
    await expect(
      nft.connect(stranger).setBaseURI("https://evil.example/"),
    ).to.be.reverted;
  });

  // ------------------------------------------------------------------
  // Interface & surface
  // ------------------------------------------------------------------
  it("supports ERC165, ERC721 and AccessControl interfaces", async function () {
    expect(await nft.supportsInterface("0x01ffc9a7")).to.equal(true); // ERC165
    expect(await nft.supportsInterface("0x80ac58cd")).to.equal(true); // ERC721
    expect(await nft.supportsInterface("0x7965db0b")).to.equal(true); // AccessControl
    expect(await nft.supportsInterface("0xffffffff")).to.equal(false);
  });

  it("exposes no burn function", async function () {
    const names = nft.interface.fragments.map((f: { name?: string }) => f.name);
    expect(names).not.to.include("burn");
    expect(names).not.to.include("burnMonster");
  });

  it("exposes no public mutation of identity fields", async function () {
    const names = nft.interface.fragments.map((f: { name?: string }) => f.name);
    for (const forbidden of ["setDNA", "setGeneration", "setRarity", "setGameMonsterId"]) {
      expect(names).not.to.include(forbidden);
    }
  });
});

describe("hash helpers (TypeScript ↔ Solidity)", function () {
  it("matches the Solidity DNA hash for the canonical ABI encoding", async function () {
    const factory = await ethers.getContractFactory("DNAHashProbe");
    const probe = await factory.deploy();
    await probe.waitForDeployment();

    const tsHash = hashMonsterDNA(DNA);
    const solidityHash = await probe.computeDnaHash(
      DNA.hpGene,
      DNA.attackGene,
      DNA.defenseGene,
      DNA.speedGene,
      DNA.mutationGene,
    );
    expect(tsHash).to.equal(solidityHash);
  });

  it("matches the Solidity game-monster-id hash", async function () {
    const factory = await ethers.getContractFactory("DNAHashProbe");
    const probe = await factory.deploy();
    await probe.waitForDeployment();

    const id = "monster-abc";
    expect(hashGameMonsterId(id)).to.equal(
      await probe.computeGameMonsterIdHash(id),
    );
  });

  it("is deterministic for the same DNA", async function () {
    expect(hashMonsterDNA(DNA)).to.equal(hashMonsterDNA(DNA));
  });

  it("builds a complete mint payload from game data", async function () {
    const fireCub = getSpeciesBySlug("firecub");
    if (!fireCub) throw new Error("fixture missing");
    const payload = buildMonsterMintPayload(
      {
        id: "monster-abc",
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
        owner: "0x0000000000000000000000000000000000000001",
        generation: 1,
        battleCount: 0,
        wins: 0,
        dna: DNA,
      },
      fireCub,
      getEvolutionStage(fireCub),
    );
    expect(payload.gameMonsterIdHash).to.equal(hashGameMonsterId("monster-abc"));
    expect(payload.speciesId).to.equal(1);
    expect(payload.generation).to.equal(1);
    expect(payload.rarity).to.equal(0); // Common
    expect(payload.evolutionStage).to.equal(0); // FireCub = base
    expect(payload.dnaHash).to.equal(hashMonsterDNA(DNA));
  });
});
