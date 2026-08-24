/**
 * ChainGateway — the single seam between game services and the blockchain.
 * Services depend on this interface (tests inject a FakeChainGateway);
 * production uses ViemChainGateway (server-client.ts, server-only).
 */

import type {
  ChainReceipt,
  ChainTransaction,
  MonsterMintPayload,
  OnchainMonsterData,
} from "./types";

export type Web3ErrorKind =
  | "config"
  | "rpc"
  | "reverted"
  | "role"
  | "contract"
  | "pending";

export class Web3Error extends Error {
  readonly kind: Web3ErrorKind;

  constructor(message: string, kind: Web3ErrorKind) {
    super(message);
    this.name = "Web3Error";
    this.kind = kind;
  }
}

export interface ChainGateway {
  readonly chainId: number;
  readonly contractAddress: `0x${string}`;
  readonly backendAddress: `0x${string}`;
  readonly marketplaceAddress: `0x${string}`;

  getContractVersion(): Promise<string>;
  /** Actual chain id reported by the RPC (Phase 9 — never trust env alone). */
  getRpcChainId(): Promise<number>;
  getMonster(tokenId: bigint): Promise<OnchainMonsterData>;
  getOwner(tokenId: bigint): Promise<`0x${string}`>;
  isGameMonsterMinted(gameMonsterIdHash: `0x${string}`): Promise<boolean>;
  getTokenIdByGameMonsterId(gameMonsterIdHash: `0x${string}`): Promise<bigint>;
  hasRole(role: "MINTER" | "EVOLVER", address: `0x${string}`): Promise<boolean>;

  /** Server-only writes (backend operator wallet). */
  mintMonster(to: `0x${string}`, payload: MonsterMintPayload): Promise<`0x${string}`>;
  evolveMonster(
    tokenId: bigint,
    newSpeciesId: number,
    newEvolutionStage: number,
  ): Promise<`0x${string}`>;

  /** Receipt helpers. null = still pending / not found (never treat as failure). */
  getTransaction(txHash: `0x${string}`): Promise<ChainTransaction | null>;
  getTransactionReceipt(txHash: `0x${string}`): Promise<ChainReceipt | null>;
  waitForTransactionReceipt(
    txHash: `0x${string}`,
    timeoutMs: number,
  ): Promise<ChainReceipt | null>;

  // Marketplace (Phase 8) — read-only on the server side (user wallets sign writes).
  getMarketplaceListing(tokenId: bigint): Promise<{
    seller: `0x${string}`;
    price: bigint;
    active: boolean;
  }>;
  getMarketplaceVersion(): Promise<string>;
  getMarketplaceMonsterNFT(): Promise<`0x${string}`>;
  isMarketplacePaused(): Promise<boolean>;
  isNftApprovedForMarketplace(
    owner: `0x${string}`,
    tokenId: bigint,
  ): Promise<boolean>;
}
