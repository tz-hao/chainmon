import marketplaceAbi from "../../../../contracts/abis/MonsterMarketplace.json";
import {
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  getAddress,
  parseAbiParameters,
  type Abi,
} from "viem";
import {
  ChainGateway,
  Web3Error,
} from "./chain-gateway";
import type {
  ChainReceipt,
  ChainLog,
  ChainTransaction,
  MonsterMintPayload,
  OnchainMonsterData,
} from "./types";

const MARKETPLACE_ABI = marketplaceAbi.abi as Abi;
const MARKETPLACE_TX = "0xef00000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

export interface FakeContractState {
  monsters: Map<bigint, OnchainMonsterData>;
  owners: Map<bigint, `0x${string}`>;
  tokenByGameId: Map<`0x${string}`, bigint>;
  nextTokenId: bigint;
  minterRole: `0x${string}`[];
  evolverRole: `0x${string}`[];
  version: string;
}

/**
 * In-memory ChainGateway for service tests. Mirrors MonsterNFT semantics:
 * double-mint rejection, sequential token ids, evolution stage +1 rule,
 * identity preservation.
 */
export class FakeChainGateway implements ChainGateway {
  readonly chainId = 31337;
  readonly contractAddress = "0x00000000000000000000000000000000000000F4" as `0x${string}`;
  readonly backendAddress = "0x00000000000000000000000000000000000000B4" as `0x${string}`;

  state: FakeContractState = {
    monsters: new Map(),
    owners: new Map(),
    tokenByGameId: new Map(),
    nextTokenId: 1n,
    minterRole: [this.backendAddress],
    evolverRole: [this.backendAddress],
    version: "1.0.0",
  };

  /** Scripted tx behavior: "success" | "reverted" | "pending" */
  mintResult: "success" | "reverted" | "pending" = "success";
  evolveResult: "success" | "reverted" | "pending" = "success";
  /** Marketplace user-wallet txs (0xef... prefix). */
  marketplaceTxResult: "success" | "reverted" | "pending" = "success";

  /** Call counters (duplicate-protection tests). */
  mintCalls = 0;
  evolveCalls = 0;

  async getContractVersion(): Promise<string> {
    return this.state.version;
  }

  async getRpcChainId(): Promise<number> {
    return this.chainId;
  }

  async getMonster(tokenId: bigint): Promise<OnchainMonsterData> {
    const data = this.state.monsters.get(tokenId);
    if (!data) throw new Web3Error("TokenDoesNotExist", "contract");
    return data;
  }

  async getOwner(tokenId: bigint): Promise<`0x${string}`> {
    const owner = this.state.owners.get(tokenId);
    if (!owner) throw new Web3Error("TokenDoesNotExist", "contract");
    return owner;
  }

  async isGameMonsterMinted(gameMonsterIdHash: `0x${string}`): Promise<boolean> {
    return this.state.tokenByGameId.has(gameMonsterIdHash);
  }

  async getTokenIdByGameMonsterId(gameMonsterIdHash: `0x${string}`): Promise<bigint> {
    return this.state.tokenByGameId.get(gameMonsterIdHash) ?? 0n;
  }

  async hasRole(
    role: "MINTER" | "EVOLVER",
    address: `0x${string}`,
  ): Promise<boolean> {
    const list = role === "MINTER" ? this.state.minterRole : this.state.evolverRole;
    return list.includes(address);
  }

  async mintMonster(to: `0x${string}`, payload: MonsterMintPayload): Promise<`0x${string}`> {
    this.mintCalls += 1;
    if (!this.state.minterRole.includes(this.backendAddress)) {
      throw new Web3Error("Backend wallet does not have MINTER_ROLE.", "role");
    }
    if (this.state.tokenByGameId.has(payload.gameMonsterIdHash)) {
      throw new Web3Error("GameMonsterAlreadyMinted", "reverted");
    }
    if (this.mintResult === "reverted") {
      throw new Web3Error("Mint transaction reverted on chain", "reverted");
    }
    const txHash = `0x${"ab".repeat(32)}${this.state.nextTokenId
      .toString(16)
      .padStart(2, "0")}` as `0x${string}`;
    if (this.mintResult === "pending") {
      return txHash; // submitted but not mined — chain state unchanged
    }
    const tokenId = this.state.nextTokenId;
    this.state.nextTokenId += 1n;
    this.state.monsters.set(tokenId, {
      speciesId: BigInt(payload.speciesId),
      generation: BigInt(payload.generation),
      rarity: BigInt(payload.rarity),
      evolutionStage: BigInt(payload.evolutionStage),
      dnaHash: payload.dnaHash,
      gameMonsterIdHash: payload.gameMonsterIdHash,
    });
    this.state.owners.set(tokenId, to);
    this.state.tokenByGameId.set(payload.gameMonsterIdHash, tokenId);
    return txHash;
  }

  async evolveMonster(
    tokenId: bigint,
    newSpeciesId: number,
    newEvolutionStage: number,
  ): Promise<`0x${string}`> {
    this.evolveCalls += 1;
    if (!this.state.evolverRole.includes(this.backendAddress)) {
      throw new Web3Error("Backend wallet does not have EVOLVER_ROLE.", "role");
    }
    const data = this.state.monsters.get(tokenId);
    if (!data) throw new Web3Error("TokenDoesNotExist", "contract");
    if (this.evolveResult === "reverted") {
      throw new Web3Error("Evolution transaction reverted on chain", "reverted");
    }
    if (BigInt(newEvolutionStage) !== data.evolutionStage + 1n) {
      throw new Web3Error("InvalidEvolutionStage", "reverted");
    }
    if (this.evolveResult === "pending") {
      return `0x${"cd".repeat(32)}` as `0x${string}`; // not mined yet
    }
    data.speciesId = BigInt(newSpeciesId);
    data.evolutionStage = BigInt(newEvolutionStage);
    return `0x${"cd".repeat(32)}` as `0x${string}`;
  }

  async getTransactionReceipt(txHash: `0x${string}`): Promise<ChainReceipt | null> {
    const result = this.resultFor(txHash);
    if (result === "pending") return null;
    return {
      status: result === "success" ? "success" : "reverted",
      blockNumber: 1n,
      logs: result === "success" ? this.marketplaceReceipts.get(txHash)?.logs ?? [] : [],
    };
  }

  async getTransaction(txHash: `0x${string}`): Promise<ChainTransaction | null> {
    return this.marketplaceTransactions.get(txHash) ?? null;
  }

  async waitForTransactionReceipt(
    txHash: `0x${string}`,
    _timeoutMs: number,
  ): Promise<ChainReceipt | null> {
    const result = this.resultFor(txHash);
    if (result === "pending") return null;
    return {
      status: result === "success" ? "success" : "reverted",
      blockNumber: 1n,
      logs: result === "success" ? this.marketplaceReceipts.get(txHash)?.logs ?? [] : [],
    };
  }

  // ---------------- Marketplace (Phase 8) ----------------

  readonly marketplaceAddress = "0x00000000000000000000000000000000000000F5" as `0x${string}`;
  marketplaceListings = new Map<bigint, { seller: `0x${string}`; price: bigint; active: boolean }>();
  marketplacePaused = false;
  /** tokenId → approved spender */
  nftApprovals = new Map<bigint, `0x${string}`>();
  /** owner → approval for all */
  nftApprovalForAll = new Map<`0x${string}`, boolean>();
  marketplaceTransactions = new Map<`0x${string}`, ChainTransaction>();
  marketplaceReceipts = new Map<`0x${string}`, ChainReceipt>();

  setNftApproval(tokenId: bigint, spender: `0x${string}`): void {
    this.nftApprovals.set(tokenId, spender);
  }

  setNftApprovalForAll(owner: `0x${string}`, approved: boolean): void {
    this.nftApprovalForAll.set(owner, approved);
  }

  async getMarketplaceListing(tokenId: bigint) {
    const listing = this.marketplaceListings.get(tokenId);
    return {
      seller: (listing?.seller ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
      price: listing?.price ?? 0n,
      active: listing?.active ?? false,
    };
  }

  async getMarketplaceVersion(): Promise<string> {
    return "1.0.0";
  }

  async getMarketplaceMonsterNFT(): Promise<`0x${string}`> {
    return this.contractAddress;
  }

  async isMarketplacePaused(): Promise<boolean> {
    return this.marketplacePaused;
  }

  async isNftApprovedForMarketplace(owner: `0x${string}`, tokenId: bigint): Promise<boolean> {
    return (
      this.nftApprovals.get(tokenId) === this.marketplaceAddress ||
      this.nftApprovalForAll.get(owner) === true
    );
  }

  /** Simulates a successful user-wallet listMonster tx. */
  async listOnMarketplace(tokenId: bigint, price: bigint, txHash = MARKETPLACE_TX): Promise<void> {
    const owner = this.state.owners.get(tokenId);
    if (!owner) throw new Web3Error("TokenDoesNotExist", "contract");
    const existing = this.marketplaceListings.get(tokenId);
    if (existing?.active) throw new Web3Error("AlreadyListed", "reverted");
    if (!(await this.isNftApprovedForMarketplace(owner, tokenId))) {
      throw new Web3Error("MarketplaceNotApproved", "reverted");
    }
    this.marketplaceListings.set(tokenId, { seller: owner, price, active: true });
    this.recordMarketplaceTransaction(txHash, "listMonster", tokenId, owner, price);
  }

  async cancelOnMarketplace(tokenId: bigint, txHash = MARKETPLACE_TX): Promise<void> {
    const listing = this.marketplaceListings.get(tokenId);
    if (!listing?.active) throw new Web3Error("ListingNotActive", "reverted");
    listing.active = false;
    this.recordMarketplaceTransaction(txHash, "cancelListing", tokenId, listing.seller, 0n);
  }

  /** Simulates a successful user-wallet buyMonster tx (exact price). */
  async buyOnMarketplace(tokenId: bigint, buyer: `0x${string}`, value: bigint, txHash = MARKETPLACE_TX): Promise<void> {
    const listing = this.marketplaceListings.get(tokenId);
    if (!listing?.active) throw new Web3Error("ListingNotActive", "reverted");
    if (value !== listing.price) throw new Web3Error("IncorrectPayment", "reverted");
    const owner = this.state.owners.get(tokenId);
    if (owner !== listing.seller) throw new Web3Error("SellerNoLongerOwner", "reverted");
    if (!(await this.isNftApprovedForMarketplace(owner, tokenId))) {
      throw new Web3Error("MarketplaceNotApproved", "reverted");
    }
    listing.active = false;
    this.state.owners.set(tokenId, buyer);
    this.recordMarketplaceTransaction(txHash, "buyMonster", tokenId, buyer, value, listing.seller);
  }

  /** Script a submitted marketplace transaction without changing chain state. */
  submitMarketplaceTransaction(
    method: "listMonster" | "cancelListing" | "buyMonster",
    tokenId: bigint,
    from: `0x${string}`,
    price = 0n,
    seller = from,
    txHash = MARKETPLACE_TX,
  ): void {
    this.recordMarketplaceTransaction(txHash, method, tokenId, from, price, seller);
  }

  private recordMarketplaceTransaction(
    txHash: `0x${string}`,
    method: "listMonster" | "cancelListing" | "buyMonster",
    tokenId: bigint,
    from: `0x${string}`,
    price: bigint,
    seller = from,
  ): void {
    const input = encodeFunctionData({
      abi: MARKETPLACE_ABI,
      functionName: method,
      args: method === "listMonster" ? [tokenId, price] : [tokenId],
    });
    this.marketplaceTransactions.set(txHash, {
      to: this.marketplaceAddress,
      from,
      input,
      value: method === "buyMonster" ? price : 0n,
    });
    const eventName = method === "listMonster"
      ? "MonsterListed"
      : method === "cancelListing"
        ? "ListingCancelled"
        : "MonsterSold";
    const eventArgs = method === "buyMonster"
      ? { tokenId, seller, buyer: from, price }
      : method === "listMonster"
        ? { tokenId, seller: from, price }
        : { tokenId, seller: from };
    this.marketplaceReceipts.set(txHash, {
      status: "success",
      blockNumber: 1n,
      logs: [this.marketplaceLog(eventName, eventArgs)],
    });
  }

  private marketplaceLog(eventName: string, args: Record<string, unknown>): ChainLog {
    const topics = encodeEventTopics({
      abi: MARKETPLACE_ABI,
      eventName: eventName as never,
      args: args as never,
    }) as readonly `0x${string}`[];
    const price = args.price as bigint | undefined;
    return {
      address: this.marketplaceAddress,
      topics: [...topics],
      data: price === undefined
        ? "0x"
        : encodeAbiParameters(parseAbiParameters("uint256"), [price]),
    };
  }

  private resultFor(txHash: `0x${string}`): string {
    if (txHash.startsWith("0xab")) return this.mintResult;
    if (txHash.startsWith("0xcd")) return this.evolveResult;
    if (txHash.startsWith("0xef")) return this.marketplaceTxResult;
    return "pending";
  }
}

// Helper: canonicalize addresses in tests
export function canon(addr: string): `0x${string}` {
  return getAddress(addr) as `0x${string}`;
}
