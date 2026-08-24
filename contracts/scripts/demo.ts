/**
 * Local-only demo chain (Hardhat network). NOT wired into the web app.
 *
 *   Deploy → Grant roles → Build FireCub payload → Mint to Player A →
 *   Read ownerOf/getMonster → Duplicate mint reverts → Transfer A→B →
 *   EVOLVER_ROLE evolves FireCub → FireWolf → identity preserved → events
 *
 * Run: npx hardhat run scripts/demo.ts
 */

import { ethers } from "hardhat";
import {
  buildMonsterMintPayload,
  hashGameMonsterId,
} from "./hash-helpers";
import { getEvolutionStage, getSpeciesBySlug } from "@chainmon/monster-data";

const DNA = {
  hpGene: 63,
  attackGene: 77,
  defenseGene: 41,
  speedGene: 88,
  mutationGene: 12,
};

async function main() {
  const [deployer, playerA, playerB] = await ethers.getSigners();

  // 1. Deploy
  const factory = await ethers.getContractFactory("MonsterNFT");
  const nft = await factory.deploy(
    "ChainMon Monsters",
    "CMON",
    "https://api.chainmon.game/metadata/",
    deployer.address,
  );
  await nft.waitForDeployment();
  const address = await nft.getAddress();
  console.log(`[1] Deployed MonsterNFT at ${address}`);

  // 2. Build a FireCub mint payload (server-side helper)
  const fireCub = getSpeciesBySlug("firecub");
  if (!fireCub) throw new Error("firecub species missing");
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
      owner: playerA.address,
      generation: 1,
      battleCount: 0,
      wins: 0,
      dna: DNA,
    },
    fireCub,
    getEvolutionStage(fireCub), // 0
  );
  console.log("[2] FireCub payload:", payload);

  // 3. Mint to Player A
  const tx = await nft.mintMonster(playerA.address, payload);
  const receipt = await tx.wait();
  console.log(
    `[3] Minted token #${await nft.getTokenIdByGameMonsterIdHash(payload.gameMonsterIdHash)} to ${playerA.address} (tx ${tx.hash})`,
  );

  // 4. Read
  const tokenId = 1n;
  const owner = await nft.ownerOf(tokenId);
  const monster = await nft.getMonster(tokenId);
  console.log(`[4] ownerOf(1) = ${owner}`);
  console.log(`    getMonster(1) = speciesId=${monster.speciesId} stage=${monster.evolutionStage} dnaHash=${monster.dnaHash}`);
  const sameHash = monster.dnaHash === payload.dnaHash;
  console.log(`    dnaHash matches payload: ${sameHash}`);

  // 5. Duplicate mint must revert
  try {
    await nft.mintMonster(playerA.address, payload);
    console.log("[5] ERROR: duplicate mint did NOT revert");
    process.exitCode = 1;
    return;
  } catch {
    console.log("[5] Duplicate mint reverted as expected");
  }

  // 6. Transfer A → B
  await nft.connect(playerA).safeTransferFrom(playerA.address, playerB.address, tokenId);
  console.log(`[6] Transferred token #${tokenId} → ${playerB.address}; owner now ${await nft.ownerOf(tokenId)}`);

  // 7. Evolve FireCub → FireWolf (EVOLVER_ROLE = deployer)
  const fireWolf = getSpeciesBySlug("firewolf");
  if (!fireWolf) throw new Error("firewolf species missing");
  await nft.evolveMonster(tokenId, fireWolf.id, getEvolutionStage(fireWolf));
  const evolved = await nft.getMonster(tokenId);
  console.log(
    `[7] Evolved: speciesId=${evolved.speciesId} stage=${evolved.evolutionStage}`,
  );
  console.log(
    `    Identity preserved: owner=${await nft.ownerOf(tokenId)} dnaHash=${evolved.dnaHash === payload.dnaHash}`,
  );

  console.log("Demo chain complete ✅");
}

main().catch((error) => {
  console.error("Demo failed:", error);
  process.exitCode = 1;
});
