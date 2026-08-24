/**
 * @chainmon/shared
 * Core domain types and constants shared across the ChainMon monorepo
 * (web app, game engine, contracts tooling, docs).
 */

// ---------- Elements & Rarities ----------

export * from "./onchain";

/** NFT mint state machine (Phase 7). */
export type MintStatus =
  | "OFFCHAIN"
  | "MINT_PENDING"
  | "MINT_SUBMITTED"
  | "MINT_CONFIRMED"
  | "MINT_FAILED";

/** On-chain evolution job status (Phase 7). */
export type OnchainEvolutionStatus =
  | "EVOLUTION_PENDING"
  | "EVOLUTION_SUBMITTED"
  | "CHAIN_CONFIRMED"
  | "SYNCED"
  | "SYNC_FAILED";

export type Element = "fire" | "water" | "nature" | "electric";

export type Rarity = "common" | "rare" | "epic" | "legendary";

export const ELEMENTS: readonly Element[] = ["fire", "water", "nature", "electric"];

export const RARITIES: readonly Rarity[] = ["common", "rare", "epic", "legendary"];

export const ELEMENT_LABELS: Record<Element, string> = {
  fire: "Fire",
  water: "Water",
  nature: "Nature",
  electric: "Electric",
};

export const RARITY_LABELS: Record<Rarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

// ---------- Domain types ----------

export interface Skill {
  id: string;
  name: string;
  element: Element;
  power: number;
  accuracy: number;
  description?: string;
  /** Web3 knowledge attached to the skill (Pixel World Upgrade). */
  knowledgeTitle?: string;
  knowledgeSummary?: string;
}

/** Monster DNA — each gene 0-100; drives stat growth (breeding-ready). */
export interface MonsterDNA {
  attackGene: number;
  defenseGene: number;
  speedGene: number;
  hpGene: number;
  mutationGene: number;
}

export interface Monster {
  id: string;
  tokenId?: string;
  speciesId: number;
  name: string;
  element: Element;
  rarity: Rarity;
  level: number;
  exp: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  skills: Skill[];
  /** owning trainer id; null when owned on-chain by an unbound wallet */
  owner: string | null;
  /** on-chain owner wallet (lowercase) when owned outside ChainMon */
  onchainOwnerAddress?: string;
  generation: number;
  parents?: {
    father?: string;
    mother?: string;
  };
  battleCount: number;
  wins: number;
  /** Individual DNA (genes 0-100) — drives stat growth, shown on the detail page. */
  dna: MonsterDNA;
  // Phase 7 NFT mint state (undefined ⇒ OFFCHAIN)
  mintStatus?: MintStatus;
  mintTxHash?: string;
  mintChainId?: number;
  mintContractAddress?: string;
  mintRecipient?: string;
  mintError?: string;
  mintSubmittedAt?: Date;
  mintConfirmedAt?: Date;
  mintUpdatedAt?: Date;
  ownershipMismatch?: boolean;
}

export interface TrainerProfile {
  id: string;
  nickname: string;
  walletAddress?: string;
  gold: number;
  wins: number;
  battleCount: number;
  captures: number;
}
