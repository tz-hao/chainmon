import {
  generateMonster,
  resetRandomSource,
} from "@chainmon/game-engine";
import { getSpeciesBySlug } from "@chainmon/monster-data";
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import * as path from "path";
import { privateKeyToAccount } from "viem/accounts";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  type Abi,
} from "viem";
import { prisma } from "@/lib/prisma";
import { prismaRepository } from "../prisma-repository";
import { createTrainerWithStarter } from "../demo-service";
import {
  createBattle,
  submitBattleAction,
} from "../../services/battle-service";
import { claimNft } from "../../services/nft-claim-service";
import { evolveMintedMonster } from "../../services/evolution-sync-service";
import { syncMonsterOwnership } from "../../services/ownership-sync-service";
import { ViemChainGateway } from "../../web3/server-client";
import { hashGameMonsterId, hashMonsterDNA } from "../../web3/hash";
import { chainmonChain } from "../../web3/chain";
import monsterNftAbi from "../../../../../contracts/abis/MonsterNFT.json";

/**
 * COMPLETE Monad Testnet E2E (real PostgreSQL + real Monad chain):
 *   Trainer A → starter → claim NFT (real Monad mint, full state machine)
 *   → on-chain evolution (FireCub → FireWolf) → Trainer B buys nothing here
 *   (marketplace covered by monad-testnet-integration) → direct transfer
 *   ownership sync → buyer collection/team/battle.
 *
 * Run explicitly (Monad contracts deployed + PostgreSQL up):
 *   RUN_MONAD_TESTNET_E2E=1 RUN_MONAD_TESTNET_INTEGRATION=1 ... \
 *   npx vitest run apps/web/lib/data/__tests__/e2e-monad.test.ts
 */

const RUN = process.env.RUN_MONAD_TESTNET_E2E === "1";

function normalizeKey(raw: string | undefined): `0x${string}` | null {
  if (!raw) return null;
  const key = raw.startsWith("0x") ? raw : `0x${raw}`;
  return /^0x[0-9a-fA-F]{64}$/.test(key) ? (key as `0x${string}`) : null;
}

function loadContractEnv() {
  const file = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "..",
    "contracts",
    ".env",
  );
  if (!require("fs").existsSync(file)) return;
  for (const line of require("fs").readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2]!.replace(/^["']|["']$/g, "");
    }
  }
}
loadContractEnv();

function readDeployment() {
  const file = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "..",
    "contracts",
    "deployments",
    "monadTestnet.json",
  );
  return JSON.parse(readFileSync(file, "utf8")) as {
    chainId: string;
    MonsterNFT: string;
  };
}

describe.skipIf(!RUN)("complete Monad Testnet E2E (real DB + real chain)", () => {
  it(
    "claim → evolution → ownership sync → buyer gameplay on Monad",
    { timeout: 300_000 },
    async () => {
      // Fresh business state (seed data preserved).
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
      resetRandomSource();

      const sellerKey = normalizeKey(process.env.MONAD_DEPLOYER_PRIVATE_KEY);
      const buyerKey = normalizeKey(process.env.MONAD_TESTNET_BUYER_PRIVATE_KEY);
      if (!sellerKey || !buyerKey) {
        throw new Error("MONAD keys required for E2E");
      }
      const sellerAccount = privateKeyToAccount(sellerKey);
      const buyerAccount = privateKeyToAccount(buyerKey);

      // ---------- Trainer A + starter ----------
      const { trainer: ash, monster } = await createTrainerWithStarter(
        prismaRepository,
        "MonadAsh",
        "firecub",
      );
      await prismaRepository.bindWallet(ash.id, sellerAccount.address);

      // ---------- Real NFT claim on Monad (full state machine) ----------
      const gateway = new ViemChainGateway();
      const claim = await claimNft(
        prismaRepository,
        gateway,
        ash.id,
        monster.id,
      );
      expect(claim.status).toBe("MINT_CONFIRMED");
      expect(claim.tokenId).toBeTruthy();
      const tokenId = BigInt(claim.tokenId!);

      // DB identity written with Monad chain id + contract.
      const db = await prisma.monster.findUnique({ where: { id: monster.id } });
      expect(db?.mintStatus).toBe("MINT_CONFIRMED");
      expect(db?.mintChainId).toBe(10143);
      expect(db?.mintContractAddress?.toLowerCase()).toBe(
        getAddress(readDeployment().MonsterNFT).toLowerCase(),
      );
      expect(db?.mintTxHash).toBeTruthy();
      expect(db?.tokenId).toBe(claim.tokenId);

      // On-chain read-back.
      const onchain = await gateway.getMonster(tokenId);
      expect(onchain.gameMonsterIdHash).toBe(hashGameMonsterId(monster.id));
      expect(onchain.dnaHash).toBe(hashMonsterDNA(monster.dna));
      expect(Number(onchain.speciesId)).toBe(monster.speciesId);
      expect((await gateway.getOwner(tokenId)).toLowerCase()).toBe(
        sellerAccount.address.toLowerCase(),
      );

      // ---------- Evolution (fixture: FireCub Lv16 + Fire Stone) ----------
      const fireStone = await prisma.item.findUnique({
        where: { slug: "fire-stone" },
      });
      if (fireStone) {
        const inv = await prisma.inventory.findUnique({
          where: {
            trainerId_itemId: { trainerId: ash.id, itemId: fireStone.id },
          },
        });
        if (!inv) {
          await prisma.inventory.create({
            data: { trainerId: ash.id, itemId: fireStone.id, quantity: 1 },
          });
        } else {
          await prisma.inventory.update({
            where: {
              trainerId_itemId: { trainerId: ash.id, itemId: fireStone.id },
            },
            data: { quantity: { increment: 1 } },
          });
        }
      }
      await prisma.monster.update({
        where: { id: monster.id },
        data: { level: 16, exp: 1600 },
      });
      const evo = await evolveMintedMonster(
        prismaRepository,
        gateway,
        ash.id,
        monster.id,
      );
      expect(evo.status).toBe("synced");
      const evolvedOnchain = await gateway.getMonster(tokenId);
      expect(Number(evolvedOnchain.speciesId)).toBe(2); // FireWolf
      expect(Number(evolvedOnchain.evolutionStage)).toBe(1);
      expect(evolvedOnchain.dnaHash).toBe(hashMonsterDNA(monster.dna)); // immutable
      expect(evolvedOnchain.gameMonsterIdHash).toBe(
        hashGameMonsterId(monster.id),
      );
      const dbAfterEvo = await prisma.monster.findUnique({
        where: { id: monster.id },
      });
      expect(dbAfterEvo?.speciesId).toBe(2);
      expect(dbAfterEvo?.tokenId).toBe(claim.tokenId); // unchanged

      // ---------- Ownership sync: seller → buyer (direct transfer) ----------
      const nftAbi = monsterNftAbi.abi as Abi;
      const sellerClient = createWalletClient({
        account: sellerAccount,
        chain: chainmonChain,
        transport: http(),
      });
      const publicClient = createPublicClient({
        chain: chainmonChain,
        transport: http(),
      });
      const transferTx = await sellerClient.writeContract({
        address: getAddress(readDeployment().MonsterNFT),
        abi: nftAbi,
        chain: chainmonChain,
        functionName: "transferFrom",
        args: [
          sellerAccount.address,
          buyerAccount.address,
          tokenId,
        ],
      });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: transferTx,
        timeout: 120_000,
      });
      expect(receipt.status).toBe("success");
      expect((await gateway.getOwner(tokenId)).toLowerCase()).toBe(
        buyerAccount.address.toLowerCase(),
      );

      // Buyer trainer B bound to the buyer wallet.
      const userB = await prisma.user.create({
        data: { walletAddress: buyerAccount.address.toLowerCase() },
      });
      const misty = await prisma.trainer.create({
        data: { userId: userB.id, nickname: "MonadMisty" },
      });

      const synced = await syncMonsterOwnership(
        prismaRepository,
        gateway,
        monster.id,
      );
      expect(synced.owner).toBe(misty.id);
      const dbAfterSync = await prisma.monster.findUnique({
        where: { id: monster.id },
      });
      expect(dbAfterSync?.ownerId).toBe(misty.id);
      expect(dbAfterSync?.onchainOwnerAddress?.toLowerCase()).toBe(
        buyerAccount.address.toLowerCase(),
      );

      // ---------- Buyer collection + team + battle ----------
      const leafcat = getSpeciesBySlug("leafcat")!;
      const aquaturtle = getSpeciesBySlug("aquaturtle")!;
      const second = generateMonster(leafcat, { owner: misty.id });
      const third = generateMonster(aquaturtle, { owner: misty.id });
      await prisma.monster.create({
        data: {
          id: second.id,
          speciesId: second.speciesId,
          name: second.name,
          level: second.level,
          exp: second.exp,
          hp: second.hp,
          attack: second.attack,
          defense: second.defense,
          speed: second.speed,
          dna: second.dna as unknown as object,
          generation: second.generation,
          battleCount: second.battleCount,
          wins: second.wins,
          ownerId: misty.id,
        },
      });
      await prisma.monster.create({
        data: {
          id: third.id,
          speciesId: third.speciesId,
          name: third.name,
          level: third.level,
          exp: third.exp,
          hp: third.hp,
          attack: third.attack,
          defense: third.defense,
          speed: third.speed,
          dna: third.dna as unknown as object,
          generation: third.generation,
          battleCount: third.battleCount,
          wins: third.wins,
          ownerId: misty.id,
        },
      });
      await prisma.monster.updateMany({
        where: { ownerId: misty.id },
        data: { attack: 999, defense: 999 },
      });
      const mistyMonsters = await prisma.monster.findMany({
        where: { ownerId: misty.id },
        orderBy: { createdAt: "asc" },
      });
      expect(mistyMonsters.length).toBe(3);
      expect(mistyMonsters.some((m) => m.id === monster.id)).toBe(true); // purchased monster in collection

      await prismaRepository.saveTeam(
        misty.id,
        mistyMonsters.map((m) => m.id),
      );
      const battle = await createBattle(prismaRepository, misty.id);
      let current = battle;
      for (let i = 0; i < 50 && current.status === "active"; i++) {
        const result = await submitBattleAction(prismaRepository, {
          trainerId: misty.id,
          battleId: battle.id,
          expectedTurn: current.turn,
          action: { type: "basic_attack" },
        });
        current = result.state;
      }
      expect(current.status).toBe("completed");

      console.log(
        `MONAD-E2E-OK token=${tokenId} seller=${sellerAccount.address} buyer=${buyerAccount.address}`,
      );
    },
  );
});
