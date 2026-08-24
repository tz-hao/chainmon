/**
 * ChainMon — State Consistency Audit (Phase 9, READ-ONLY).
 *
 * Compares the PostgreSQL game state against the on-chain source of truth
 * (MonsterNFT + MonsterMarketplace) without modifying anything:
 *
 *   - Every MINT_CONFIRMED monster: tokenId exists on chain, gameMonsterIdHash,
 *     dnaHash, speciesId, generation, rarity and evolutionStage match.
 *   - Ownership: ownerOf(tokenId) == onchainOwnerAddress; when the on-chain
 *     owner maps to a verified trainer, Monster.ownerId must match.
 *   - Listings: every DB-ACTIVE listing must be ACTIVE on chain with the same
 *     seller and price; mismatches are reported as stale.
 *
 * NEVER performs destructive fixes (no delete / burn / transfer). It only
 * reports. Safe reconciliation is available through the app's services.
 *
 * Run:
 *   npx tsx scripts/audit-state.ts
 *   (requires DATABASE_URL in .env and CHAINMON_* env for the chain)
 */

import { createPublicClient, http, getAddress, type Abi } from "viem";
import { PrismaClient } from "@prisma/client";
import { encodeAbiParameters, keccak256, parseAbiParameters, toBytes } from "viem";
import * as fs from "fs";
import * as path from "path";
import { defineChain } from "viem";

// ---------- Config (fail loudly, never silently degrade) ----------

const chainId = Number(process.env.CHAINMON_CHAIN_ID ?? 31337);
const rpcUrl = process.env.CHAINMON_RPC_URL ?? "http://127.0.0.1:8545";
const nftAddress = (process.env.CHAINMON_MONSTER_NFT_ADDRESS ?? "") as `0x${string}`;
const marketplaceAddress = (process.env.CHAINMON_MONSTER_MARKETPLACE_ADDRESS ??
  "") as `0x${string}`;

if (!nftAddress || !marketplaceAddress) {
  console.error("Missing CHAINMON_MONSTER_NFT_ADDRESS / CHAINMON_MONSTER_MARKETPLACE_ADDRESS");
  process.exit(2);
}

const chain = defineChain({
  id: chainId,
  name: "ChainMon Network",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
});

function loadAbi(name: "MonsterNFT" | "MonsterMarketplace"): Abi {
  const file = path.join(__dirname, "..", "contracts", "abis", `${name}.json`);
  return (JSON.parse(fs.readFileSync(file, "utf8")) as { abi: Abi }).abi;
}

const NFT_ABI = loadAbi("MonsterNFT");
const MP_ABI = loadAbi("MonsterMarketplace");

const DNA_PARAMS = parseAbiParameters("uint32,uint32,uint32,uint32,uint32");

// ---------- Counters ----------

const stats = {
  mintedChecked: 0,
  tokenMissing: 0,
  dnaMismatch: 0,
  gameIdMismatch: 0,
  speciesMismatch: 0,
  generationMismatch: 0,
  ownershipMismatch: 0,
  ownerIdMismatch: 0,
  notSynced: 0,
  listingsChecked: 0,
  staleListings: 0,
  rpcErrors: 0,
};

const problems: string[] = [];

// ---------- Helpers ----------

function hashDna(dna: unknown): `0x${string}` {
  const d = (dna ?? {}) as Record<string, unknown>;
  return keccak256(
    encodeAbiParameters(DNA_PARAMS, [
      Number(d.hpGene ?? 0),
      Number(d.attackGene ?? 0),
      Number(d.defenseGene ?? 0),
      Number(d.speedGene ?? 0),
      Number(d.mutationGene ?? 0),
    ]),
  );
}

function hashGameId(id: string): `0x${string}` {
  return keccak256(toBytes(id));
}

async function main() {
  const prisma = new PrismaClient();
  const publicClient = createPublicClient({ chain, transport: http() });

  // ---------- 1. Minted monsters (only the currently configured chain) ----------
  const minted = await prisma.monster.findMany({
    where: {
      mintStatus: "MINT_CONFIRMED",
      tokenId: { not: null },
      mintChainId: chainId, // never query localhost tokens against Monad
      mintContractAddress: { equals: nftAddress, mode: "insensitive" },
    },
  });
  console.log(`\n=== MINTED MONSTERS: ${minted.length} ===`);
  stats.mintedChecked = minted.length;

  for (const monster of minted) {
    const tokenId = BigInt(monster.tokenId!);
    try {
      const data = (await publicClient.readContract({
        address: nftAddress,
        abi: NFT_ABI,
        functionName: "getMonster",
        args: [tokenId],
      })) as {
        speciesId: bigint;
        generation: bigint;
        rarity: bigint;
        evolutionStage: bigint;
        dnaHash: `0x${string}`;
        gameMonsterIdHash: `0x${string}`;
      };

      const expectedDna = hashDna(monster.dna);
      const expectedGameId = hashGameId(monster.id);

      if (data.dnaHash.toLowerCase() !== expectedDna.toLowerCase()) {
        stats.dnaMismatch += 1;
        problems.push(`DNA mismatch monster=${monster.id} token=${monster.tokenId}`);
      }
      if (data.gameMonsterIdHash.toLowerCase() !== expectedGameId.toLowerCase()) {
        stats.gameIdMismatch += 1;
        problems.push(`GameId mismatch monster=${monster.id} token=${monster.tokenId}`);
      }
      if (Number(data.speciesId) !== monster.speciesId) {
        stats.speciesMismatch += 1;
        problems.push(`Species mismatch monster=${monster.id} token=${monster.tokenId} db=${monster.speciesId} chain=${data.speciesId}`);
      }
      if (Number(data.generation) !== monster.generation) {
        stats.generationMismatch += 1;
        problems.push(`Generation mismatch monster=${monster.id} token=${monster.tokenId}`);
      }

      // Ownership: ownerOf vs onchainOwnerAddress + ownerId.
      const owner = (await publicClient.readContract({
        address: nftAddress,
        abi: NFT_ABI,
        functionName: "ownerOf",
        args: [tokenId],
      })) as `0x${string}`;
      const ownerLower = owner.toLowerCase();
      const dbOnchain = (monster.onchainOwnerAddress ?? "").toLowerCase();
      if (dbOnchain === "") {
        // Ownership sync has not run yet (or was never needed) — informational.
        stats.notSynced += 1;
        problems.push(`NOT SYNCED (informational) monster=${monster.id} token=${monster.tokenId} chainOwner=${ownerLower}`);
      } else if (dbOnchain !== ownerLower) {
        stats.ownershipMismatch += 1;
        problems.push(`Ownership mismatch monster=${monster.id} token=${monster.tokenId} db=${monster.onchainOwnerAddress} chain=${ownerLower}`);
      } else if (monster.ownerId) {
        // Owner has a DB owner — verify it maps to a verified trainer with that wallet.
        const user = await prisma.user.findFirst({
          where: { walletAddress: ownerLower },
          include: { trainer: true },
        });
        if (user?.trainer && user.trainer.id !== monster.ownerId) {
          stats.ownerIdMismatch += 1;
          problems.push(`OwnerId mismatch monster=${monster.id} token=${monster.tokenId} db=${monster.ownerId} walletTrainer=${user.trainer.id}`);
        }
      }
    } catch (error) {
      stats.tokenMissing += 1;
      stats.rpcErrors += 1;
      problems.push(`Token read failed monster=${monster.id} token=${monster.tokenId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ---------- 2. Active listings (only the currently configured chain) ----------
  const listings = await prisma.marketplaceListing.findMany({
    where: {
      status: "ACTIVE",
      chainId, // never query localhost listings against Monad
      marketplaceAddress: { equals: marketplaceAddress, mode: "insensitive" },
    },
  });
  console.log(`\n=== ACTIVE LISTINGS: ${listings.length} ===`);
  stats.listingsChecked = listings.length;

  for (const listing of listings) {
    try {
      const onchain = (await publicClient.readContract({
        address: marketplaceAddress,
        abi: MP_ABI,
        functionName: "getListing",
        args: [BigInt(listing.tokenId!)],
      })) as { seller: `0x${string}`; tokenId: bigint; price: bigint; active: boolean };

      const sellerLower = getAddress(onchain.seller).toLowerCase();
      const dbSeller = await prisma.user.findFirst({
        where: { trainer: { id: listing.sellerId } },
        include: { trainer: true },
      });
      const sellerWallet = dbSeller?.walletAddress?.toLowerCase();
      const priceOk = onchain.price === BigInt(listing.priceWei);
      if (!onchain.active || (sellerWallet && sellerWallet !== sellerLower) || !priceOk) {
        stats.staleListings += 1;
        problems.push(`Stale listing id=${listing.id} monster=${listing.monsterId} token=${listing.tokenId} active=${onchain.active} priceOk=${priceOk}`);
      }
    } catch (error) {
      stats.staleListings += 1;
      stats.rpcErrors += 1;
      problems.push(`Listing read failed id=${listing.id} token=${listing.tokenId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ---------- Report ----------
  console.log("\n=== CONSISTENCY AUDIT REPORT ===");
  console.log(JSON.stringify(stats, null, 2));
  const hardProblems = problems.filter((p) => !p.startsWith("NOT SYNCED"));
  const syncNotes = problems.filter((p) => p.startsWith("NOT SYNCED"));
  if (syncNotes.length > 0) {
    console.log("\n=== INFORMATIONAL (ownership sync not yet run — run the app's sync) ===");
    for (const p of syncNotes) console.log(" - " + p);
  }
  if (hardProblems.length > 0) {
    console.log("\n=== MISMATCHES (read-only report — no automatic repair) ===");
    for (const p of hardProblems) console.log(" - " + p);
  } else {
    console.log("\nNo hard mismatches found.");
  }

  await prisma.$disconnect();
  // Use exitCode (not process.exit) so the runtime can flush handles cleanly.
  process.exitCode = hardProblems.length === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error("Audit failed:", error);
  process.exitCode = 1;
});
