/**
 * ChainMon Web3 types (Phase 7).
 */

export type MintStatus =
  | "OFFCHAIN"
  | "MINT_PENDING"
  | "MINT_SUBMITTED"
  | "MINT_CONFIRMED"
  | "MINT_FAILED";

export type OnchainEvolutionStatus =
  | "EVOLUTION_PENDING"
  | "EVOLUTION_SUBMITTED"
  | "CHAIN_CONFIRMED"
  | "SYNCED"
  | "SYNC_FAILED";

export interface OnchainMonsterData {
  speciesId: bigint;
  generation: bigint;
  rarity: bigint;
  evolutionStage: bigint;
  dnaHash: `0x${string}`;
  gameMonsterIdHash: `0x${string}`;
}

export interface ChainReceipt {
  status: "success" | "reverted";
  blockNumber: bigint;
  logs: ChainLog[];
}

export interface ChainLog {
  address: `0x${string}`;
  data: `0x${string}`;
  topics: `0x${string}`[];
}

/** Minimal transaction projection used to validate user-wallet marketplace calls. */
export interface ChainTransaction {
  to: `0x${string}` | null;
  from: `0x${string}`;
  input: `0x${string}`;
  value: bigint;
}

export interface MonsterMintPayload {
  gameMonsterIdHash: `0x${string}`;
  speciesId: number;
  generation: number;
  rarity: number;
  evolutionStage: number;
  dnaHash: `0x${string}`;
}
