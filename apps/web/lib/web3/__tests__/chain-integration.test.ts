import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { ViemChainGateway } from "../server-client";
import { hashGameMonsterId, hashMonsterDNA } from "../hash";

/**
 * REAL-chain integration tests against a persistent Hardhat localhost node
 * (http://127.0.0.1:8545, chainId 31337).
 *
 * Run only when explicitly enabled:
 *   RUN_CHAIN_INTEGRATION=1 CHAINMON_RPC_URL=http://127.0.0.1:8545 \
 *   CHAINMON_MONSTER_NFT_ADDRESS=0x... CHAINMON_MINTER_PRIVATE_KEY=0x... \
 *   npx vitest run apps/web/lib/web3/__tests__/chain-integration.test.ts
 *
 * These are skipped by default (no RPC dependency in CI/dev).
 */

const RUN = process.env.RUN_CHAIN_INTEGRATION === "1";

describe.skipIf(!RUN)(
  "real-chain integration (persistent localhost node)",
  () => {
    it("reads the contract version and backend roles", async () => {
      const gateway = new ViemChainGateway();
      expect(gateway.chainId).toBe(31337);
      expect(await gateway.getContractVersion()).toBe("1.0.0");
      expect(await gateway.hasRole("MINTER", gateway.backendAddress)).toBe(true);
      expect(
        await gateway.hasRole("EVOLVER", gateway.backendAddress),
      ).toBe(true);
    });

    it("mints → reads back → verifies hashes → duplicate revert → evolves", async () => {
      const gateway = new ViemChainGateway();
      const recipient = privateKeyToAccount(
        "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
      ).address;
      const dna = {
        hpGene: 63,
        attackGene: 77,
        defenseGene: 41,
        speedGene: 88,
        mutationGene: 12,
      };
      const payload = {
        gameMonsterIdHash: hashGameMonsterId(
          `integration-monster-${Date.now()}`,
        ),
        speciesId: 1, // FireCub
        generation: 1,
        rarity: 0,
        evolutionStage: 0,
        dnaHash: hashMonsterDNA(dna),
      };

      // Mint via the backend operator wallet (real transaction)
      const txHash = await gateway.mintMonster(recipient, payload);
      const receipt = await gateway.waitForTransactionReceipt(txHash, 30000);
      expect(receipt?.status).toBe("success");

      const tokenId = await gateway.getTokenIdByGameMonsterId(
        payload.gameMonsterIdHash,
      );
      expect(tokenId).toBeGreaterThan(0n);

      const owner = await gateway.getOwner(tokenId);
      expect(owner.toLowerCase()).toBe(recipient.toLowerCase());

      const data = await gateway.getMonster(tokenId);
      expect(data.dnaHash).toBe(payload.dnaHash);
      expect(data.gameMonsterIdHash).toBe(payload.gameMonsterIdHash);
      expect(Number(data.speciesId)).toBe(1);
      expect(Number(data.generation)).toBe(1);

      // Duplicate mint must revert on the real contract
      await expect(gateway.mintMonster(recipient, payload)).rejects.toThrow();

      // Evolve FireCub → FireWolf (stage 1), identity preserved
      const evolveTx = await gateway.evolveMonster(tokenId, 2, 1);
      const evolveReceipt = await gateway.waitForTransactionReceipt(
        evolveTx,
        30000,
      );
      expect(evolveReceipt?.status).toBe("success");
      const evolved = await gateway.getMonster(tokenId);
      expect(Number(evolved.speciesId)).toBe(2);
      expect(Number(evolved.evolutionStage)).toBe(1);
      expect(evolved.dnaHash).toBe(payload.dnaHash); // DNA immutable
    });
  },
);
