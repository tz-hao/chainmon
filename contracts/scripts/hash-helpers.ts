/**
 * Canonical on-chain hashing helpers — MUST match the Solidity side exactly.
 *
 * DNA hash  = keccak256(abi.encode(hpGene, attackGene, defenseGene, speedGene, mutationGene))
 *            (fixed field order — never reorder; see contracts/README.md)
 * Game ID   = keccak256(bytes(offchain monster id))
 *
 * ABI encoding is used (NOT JSON) so TypeScript and Solidity always agree.
 */

import { ONCHAIN_RARITY } from "@chainmon/shared";
import type { Monster, MonsterDNA } from "@chainmon/shared";
import type { MonsterSpeciesData } from "@chainmon/monster-data";
import { AbiCoder, keccak256, toUtf8Bytes } from "ethers";

/** Canonical DNA gene order (documented in contracts/README.md). */
export const DNA_GENE_ORDER = [
  "hpGene",
  "attackGene",
  "defenseGene",
  "speedGene",
  "mutationGene",
] as const;

export function hashMonsterDNA(dna: MonsterDNA): string {
  const coder = AbiCoder.defaultAbiCoder();
  const encoded = coder.encode(
    ["uint32", "uint32", "uint32", "uint32", "uint32"],
    [
      dna.hpGene,
      dna.attackGene,
      dna.defenseGene,
      dna.speedGene,
      dna.mutationGene,
    ],
  );
  return keccak256(encoded);
}

export function hashGameMonsterId(id: string): string {
  return keccak256(toUtf8Bytes(id));
}

export interface MonsterMintPayload {
  gameMonsterIdHash: string;
  speciesId: number;
  generation: number;
  rarity: number;
  evolutionStage: number;
  dnaHash: string;
}

/**
 * Server-side payload builder (Phase 6: unit-tested only; Phase 7 will call
 * the contract with this payload). Never built from client-supplied fields.
 */
export function buildMonsterMintPayload(
  monster: Monster,
  species: MonsterSpeciesData,
  evolutionStage: number,
): MonsterMintPayload {
  return {
    gameMonsterIdHash: hashGameMonsterId(monster.id),
    speciesId: species.id,
    generation: monster.generation,
    rarity: ONCHAIN_RARITY[monster.rarity],
    evolutionStage,
    dnaHash: hashMonsterDNA(monster.dna),
  };
}
