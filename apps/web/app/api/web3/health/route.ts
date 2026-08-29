import { NextResponse } from "next/server";
import {
  CHAINMON_CHAIN_ID,
  MONSTER_MARKETPLACE_ADDRESS,
  MONSTER_NFT_ADDRESS,
} from "@/lib/web3/chain";
import { getReadOnlyChainHealth } from "@/lib/web3/read-only-health";

export const dynamic = "force-dynamic";

/**
 * Web3 health check — never returns private keys or secrets.
 */
export async function GET() {
  try {
    const health = await getReadOnlyChainHealth();
    const marketplaceMisconfigured =
      health.marketplaceMonsterNFT.toLowerCase() !==
      health.contractAddress.toLowerCase();
    const chainMisconfigured = health.rpcChainId !== health.chainId;
    return NextResponse.json({
      connected: true,
      chainId: health.chainId,
      rpcChainId: health.rpcChainId,
      chainMisconfigured,
      contractAddress: health.contractAddress,
      contractVersion: health.contractVersion,
      backendAddress: health.backendAddress,
      minterRole: health.minterRole,
      evolverRole: health.evolverRole,
      backendWritesEnabled: health.backendAddress !== null,
      marketplaceAddress: health.marketplaceAddress,
      marketplaceVersion: health.marketplaceVersion,
      marketplacePaused: health.marketplacePaused,
      marketplaceMisconfigured,
    });
  } catch {
    return NextResponse.json({
      connected: false,
      chainId: CHAINMON_CHAIN_ID,
      contractAddress: MONSTER_NFT_ADDRESS || null,
      marketplaceAddress: MONSTER_MARKETPLACE_ADDRESS || null,
      reason: "Blockchain temporarily unavailable or not configured.",
    });
  }
}
