import "server-only";

import monsterNftAbi from "../../../../contracts/abis/MonsterNFT.json";
import monsterMarketplaceAbi from "../../../../contracts/abis/MonsterMarketplace.json";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, getAddress, http, type Abi } from "viem";
import {
  chainmonChain,
  MONSTER_MARKETPLACE_ADDRESS,
  MONSTER_NFT_ADDRESS,
} from "./chain";

const NFT_ABI = monsterNftAbi.abi as Abi;
const MARKETPLACE_ABI = monsterMarketplaceAbi.abi as Abi;

// Health endpoints must fail promptly when a public RPC is unavailable.
const HEALTH_RPC_TIMEOUT_MS = 5_000;

export type ReadOnlyChainHealth = {
  chainId: number;
  rpcChainId: number;
  contractAddress: `0x${string}`;
  contractVersion: string;
  marketplaceAddress: `0x${string}`;
  marketplaceVersion: string;
  marketplacePaused: boolean;
  marketplaceMonsterNFT: `0x${string}`;
  backendAddress: `0x${string}` | null;
  minterRole: boolean | null;
  evolverRole: boolean | null;
};

/**
 * Verifies public chain state without creating a wallet client or requiring a
 * minter key. Preview deployments deliberately operate in this read-only mode.
 */
export async function getReadOnlyChainHealth(): Promise<ReadOnlyChainHealth> {
  if (!MONSTER_NFT_ADDRESS) {
    throw new Error("MonsterNFT contract address is not configured.");
  }
  if (!MONSTER_MARKETPLACE_ADDRESS) {
    throw new Error("MonsterMarketplace contract address is not configured.");
  }

  const contractAddress = getAddress(MONSTER_NFT_ADDRESS) as `0x${string}`;
  const marketplaceAddress = getAddress(
    MONSTER_MARKETPLACE_ADDRESS,
  ) as `0x${string}`;
  const publicClient = createPublicClient({
    chain: chainmonChain,
    transport: http(undefined, {
      retryCount: 0,
      timeout: HEALTH_RPC_TIMEOUT_MS,
    }),
  });

  const minterKey = process.env.CHAINMON_MINTER_PRIVATE_KEY;
  const backendAddress = minterKey
    ? privateKeyToAccount(
        (minterKey.startsWith("0x") ? minterKey : `0x${minterKey}`) as `0x${string}`,
      ).address
    : null;

  const [
    contractVersion,
    marketplaceVersion,
    marketplacePaused,
    marketplaceMonsterNFT,
    rpcChainId,
    minterRole,
    evolverRole,
  ] = await Promise.all([
    publicClient.readContract({
      address: contractAddress,
      abi: NFT_ABI,
      functionName: "CONTRACT_VERSION",
    }),
    publicClient.readContract({
      address: marketplaceAddress,
      abi: MARKETPLACE_ABI,
      functionName: "CONTRACT_VERSION",
    }),
    publicClient.readContract({
      address: marketplaceAddress,
      abi: MARKETPLACE_ABI,
      functionName: "paused",
    }),
    publicClient.readContract({
      address: marketplaceAddress,
      abi: MARKETPLACE_ABI,
      functionName: "monsterNFT",
    }),
    publicClient.getChainId(),
    backendAddress
      ? publicClient
          .readContract({
            address: contractAddress,
            abi: NFT_ABI,
            functionName: "MINTER_ROLE",
          })
          .then((role) =>
            publicClient.readContract({
              address: contractAddress,
              abi: NFT_ABI,
              functionName: "hasRole",
              args: [role as `0x${string}`, backendAddress],
            }),
          )
      : Promise.resolve(null),
    backendAddress
      ? publicClient
          .readContract({
            address: contractAddress,
            abi: NFT_ABI,
            functionName: "EVOLVER_ROLE",
          })
          .then((role) =>
            publicClient.readContract({
              address: contractAddress,
              abi: NFT_ABI,
              functionName: "hasRole",
              args: [role as `0x${string}`, backendAddress],
            }),
          )
      : Promise.resolve(null),
  ]);

  return {
    chainId: chainmonChain.id,
    rpcChainId,
    contractAddress,
    contractVersion: contractVersion as string,
    marketplaceAddress,
    marketplaceVersion: marketplaceVersion as string,
    marketplacePaused: marketplacePaused as boolean,
    marketplaceMonsterNFT: marketplaceMonsterNFT as `0x${string}`,
    backendAddress,
    minterRole: minterRole as boolean | null,
    evolverRole: evolverRole as boolean | null,
  };
}
