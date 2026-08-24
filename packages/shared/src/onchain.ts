/**
 * @chainmon/shared — onchain.ts
 * Canonical on-chain mappings shared between the game and the contracts.
 *
 * Rarity MUST use this exact mapping everywhere:
 *   0 = Common · 1 = Rare · 2 = Epic · 3 = Legendary
 * (mirrors the Solidity enum in MonsterNFT.sol)
 */

export const ONCHAIN_RARITY = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
} as const;

export type OnchainRarityValue =
  (typeof ONCHAIN_RARITY)[keyof typeof ONCHAIN_RARITY];

/** Highest supported evolution stage on-chain (0 = base, 1, 2). */
export const MAX_ONCHAIN_EVOLUTION_STAGE = 2;
