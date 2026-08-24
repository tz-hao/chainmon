import "server-only";

import monsterNftAbi from "../../../../contracts/abis/MonsterNFT.json";
import monsterMarketplaceAbi from "../../../../contracts/abis/MonsterMarketplace.json";
import { privateKeyToAccount } from "viem/accounts";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  type Abi,
  type PublicClient,
  type WalletClient,
} from "viem";
import {
  chainmonChain,
  MONSTER_MARKETPLACE_ADDRESS,
  MONSTER_NFT_ADDRESS,
} from "./chain";
import {
  ChainGateway,
  Web3Error,
} from "./chain-gateway";
import type {
  ChainReceipt,
  ChainTransaction,
  MonsterMintPayload,
  OnchainMonsterData,
} from "./types";

const ABI = monsterNftAbi.abi as Abi;
const MARKETPLACE_ABI = monsterMarketplaceAbi.abi as Abi;

/** Server-only: the backend operator key never leaves this module. */
function requirePrivateKey(): `0x${string}` {
  const key = process.env.CHAINMON_MINTER_PRIVATE_KEY;
  if (!key) {
    throw new Web3Error(
      "CHAINMON_MINTER_PRIVATE_KEY is not configured (server-only).",
      "config",
    );
  }
  const normalized = key.startsWith("0x") ? key : `0x${key}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Web3Error("CHAINMON_MINTER_PRIVATE_KEY is invalid.", "config");
  }
  return normalized as `0x${string}`;
}

/**
 * Production ChainGateway backed by viem. Server-only — the minter private
 * key never leaves this module and never reaches the browser bundle.
 */
export class ViemChainGateway implements ChainGateway {
  readonly chainId: number;
  readonly contractAddress: `0x${string}`;
  readonly marketplaceAddress: `0x${string}`;
  readonly backendAddress: `0x${string}`;

  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private account: ReturnType<typeof privateKeyToAccount>;

  constructor() {
    if (!MONSTER_NFT_ADDRESS || !getAddress(MONSTER_NFT_ADDRESS)) {
      throw new Web3Error(
        "MonsterNFT contract address is not configured.",
        "config",
      );
    }
    if (!MONSTER_MARKETPLACE_ADDRESS || !getAddress(MONSTER_MARKETPLACE_ADDRESS)) {
      throw new Web3Error(
        "MonsterMarketplace contract address is not configured.",
        "config",
      );
    }
    this.chainId = chainmonChain.id;
    this.contractAddress = getAddress(MONSTER_NFT_ADDRESS) as `0x${string}`;
    this.marketplaceAddress = getAddress(
      MONSTER_MARKETPLACE_ADDRESS,
    ) as `0x${string}`;

    const key = requirePrivateKey();
    const account = privateKeyToAccount(key);
    this.account = account;
    this.backendAddress = account.address;

    this.publicClient = createPublicClient({
      chain: chainmonChain,
      transport: http(),
    });
    this.walletClient = createWalletClient({
      account,
      chain: chainmonChain,
      transport: http(),
    });
  }

  private async read<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw new Web3Error(
        `Blockchain RPC error: ${error instanceof Error ? error.message : String(error)}`,
        "rpc",
      );
    }
  }

  async getContractVersion(): Promise<string> {
    return this.read(async () => {
      const version = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: ABI,
        functionName: "CONTRACT_VERSION",
      });
      return version as string;
    });
  }

  async getRpcChainId(): Promise<number> {
    return this.read(async () => {
      return this.publicClient.getChainId();
    });
  }

  async getMonster(tokenId: bigint): Promise<OnchainMonsterData> {
    return this.read(async () => {
      const data = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: ABI,
        functionName: "getMonster",
        args: [tokenId],
      });
      // viem decodes the struct into an object (named tuple).
      const record = data as {
        speciesId: bigint;
        generation: bigint;
        rarity: bigint;
        evolutionStage: bigint;
        dnaHash: `0x${string}`;
        gameMonsterIdHash: `0x${string}`;
      };
      return {
        speciesId: record.speciesId,
        generation: record.generation,
        rarity: record.rarity,
        evolutionStage: record.evolutionStage,
        dnaHash: record.dnaHash,
        gameMonsterIdHash: record.gameMonsterIdHash,
      };
    });
  }

  async getOwner(tokenId: bigint): Promise<`0x${string}`> {
    return this.read(async () => {
      const owner = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: ABI,
        functionName: "ownerOf",
        args: [tokenId],
      });
      return owner as `0x${string}`;
    });
  }

  async isGameMonsterMinted(gameMonsterIdHash: `0x${string}`): Promise<boolean> {
    return this.read(async () => {
      const minted = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: ABI,
        functionName: "isGameMonsterMinted",
        args: [gameMonsterIdHash],
      });
      return minted as boolean;
    });
  }

  async getTokenIdByGameMonsterId(gameMonsterIdHash: `0x${string}`): Promise<bigint> {
    return this.read(async () => {
      const tokenId = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: ABI,
        functionName: "getTokenIdByGameMonsterIdHash",
        args: [gameMonsterIdHash],
      });
      return tokenId as bigint;
    });
  }

  async hasRole(
    role: "MINTER" | "EVOLVER",
    address: `0x${string}`,
  ): Promise<boolean> {
    return this.read(async () => {
      const roleBytes = (await this.publicClient.readContract({
        address: this.contractAddress,
        abi: ABI,
        functionName: role === "MINTER" ? "MINTER_ROLE" : "EVOLVER_ROLE",
      })) as `0x${string}`;
      const has = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: ABI,
        functionName: "hasRole",
        args: [roleBytes, address],
      });
      return has as boolean;
    });
  }

  async mintMonster(to: `0x${string}`, payload: MonsterMintPayload): Promise<`0x${string}`> {
    return this.read(async () => {
      const hash = await this.walletClient.writeContract({
        address: this.contractAddress,
        abi: ABI,
        chain: chainmonChain,
        account: this.account,
        functionName: "mintMonster",
        args: [to, payload],
      });
      return hash;
    });
  }

  async evolveMonster(
    tokenId: bigint,
    newSpeciesId: number,
    newEvolutionStage: number,
  ): Promise<`0x${string}`> {
    return this.read(async () => {
      const hash = await this.walletClient.writeContract({
        address: this.contractAddress,
        abi: ABI,
        chain: chainmonChain,
        account: this.account,
        functionName: "evolveMonster",
        args: [tokenId, newSpeciesId, newEvolutionStage],
      });
      return hash;
    });
  }

  async getTransactionReceipt(txHash: `0x${string}`): Promise<ChainReceipt | null> {
    try {
      const receipt = await this.publicClient.getTransactionReceipt({ hash: txHash });
      return {
        status: receipt.status === "success" ? "success" : "reverted",
        blockNumber: receipt.blockNumber,
        logs: receipt.logs.map((log) => ({
          address: log.address,
          data: log.data,
          topics: [...log.topics],
        })),
      };
    } catch {
      return null; // not found / still pending — never treated as failure
    }
  }

  async getTransaction(txHash: `0x${string}`): Promise<ChainTransaction | null> {
    try {
      const transaction = await this.publicClient.getTransaction({ hash: txHash });
      return {
        to: transaction.to,
        from: transaction.from,
        input: transaction.input,
        value: transaction.value,
      };
    } catch {
      return null;
    }
  }

  async waitForTransactionReceipt(
    txHash: `0x${string}`,
    timeoutMs: number,
  ): Promise<ChainReceipt | null> {
    try {
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: timeoutMs,
      });
      return {
        status: receipt.status === "success" ? "success" : "reverted",
        blockNumber: receipt.blockNumber,
        logs: receipt.logs.map((log) => ({
          address: log.address,
          data: log.data,
          topics: [...log.topics],
        })),
      };
    } catch {
      return null; // timeout — keep MINT_SUBMITTED
    }
  }

  // ---------------- Marketplace reads (Phase 8) ----------------

  private async readMarketplace<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw new Web3Error(
        `Marketplace RPC error: ${error instanceof Error ? error.message : String(error)}`,
        "rpc",
      );
    }
  }

  async getMarketplaceListing(tokenId: bigint) {
    return this.readMarketplace(async () => {
      const data = await this.publicClient.readContract({
        address: this.marketplaceAddress,
        abi: MARKETPLACE_ABI,
        functionName: "getListing",
        args: [tokenId],
      });
      const record = data as {
        seller: `0x${string}`;
        tokenId: bigint;
        price: bigint;
        active: boolean;
      };
      return { seller: record.seller, price: record.price, active: record.active };
    });
  }

  async getMarketplaceVersion(): Promise<string> {
    return this.readMarketplace(async () => {
      const version = await this.publicClient.readContract({
        address: this.marketplaceAddress,
        abi: MARKETPLACE_ABI,
        functionName: "CONTRACT_VERSION",
      });
      return version as string;
    });
  }

  async getMarketplaceMonsterNFT(): Promise<`0x${string}`> {
    return this.readMarketplace(async () => {
      const address = await this.publicClient.readContract({
        address: this.marketplaceAddress,
        abi: MARKETPLACE_ABI,
        functionName: "monsterNFT",
      });
      return address as `0x${string}`;
    });
  }

  async isMarketplacePaused(): Promise<boolean> {
    return this.readMarketplace(async () => {
      const paused = await this.publicClient.readContract({
        address: this.marketplaceAddress,
        abi: MARKETPLACE_ABI,
        functionName: "paused",
      });
      return paused as boolean;
    });
  }

  async isNftApprovedForMarketplace(
    owner: `0x${string}`,
    tokenId: bigint,
  ): Promise<boolean> {
    return this.read(async () => {
      const approved = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: ABI,
        functionName: "isApprovedForAll",
        args: [owner, this.marketplaceAddress],
      });
      if (approved as boolean) return true;
      const tokenApproved = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: ABI,
        functionName: "getApproved",
        args: [tokenId],
      });
      return (tokenApproved as `0x${string}`).toLowerCase() === this.marketplaceAddress.toLowerCase();
    });
  }
}

/** Production gateway singleton (server-side only). */
let cachedGateway: ViemChainGateway | null = null;

export function getViemGateway(): ViemChainGateway {
  cachedGateway ??= new ViemChainGateway();
  return cachedGateway;
}
