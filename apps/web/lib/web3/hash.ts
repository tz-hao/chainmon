/**
 * Canonical on-chain hashing (viem-based, Phase 7).
 * MUST match the Solidity side and the ethers helpers in contracts/scripts.
 *
 *   DNA hash  = keccak256(abi.encode(hpGene, attackGene, defenseGene, speedGene, mutationGene))
 *   Game ID   = keccak256(bytes(monster.id))
 */

import type { MonsterDNA } from "@chainmon/shared";
import {
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
  toBytes,
} from "viem";

const DNA_PARAMS = parseAbiParameters("uint32,uint32,uint32,uint32,uint32");

export function hashMonsterDNA(dna: MonsterDNA): `0x${string}` {
  return keccak256(
    encodeAbiParameters(DNA_PARAMS, [
      dna.hpGene,
      dna.attackGene,
      dna.defenseGene,
      dna.speedGene,
      dna.mutationGene,
    ]),
  );
}

export function hashGameMonsterId(id: string): `0x${string}` {
  return keccak256(toBytes(id));
}
