import { NextResponse } from "next/server";
import {
  CHAINMON_CHAIN_ID,
  MONSTER_MARKETPLACE_ADDRESS,
  MONSTER_NFT_ADDRESS,
} from "@/lib/web3/chain";
import { getChainGateway } from "@/lib/web3";

export const dynamic = "force-dynamic";

/**
 * Web3 health check — never returns private keys or secrets.
 */
export async function GET() {
  try {
    const gateway = getChainGateway();
    const [version, minter, evolver, mpVersion, mpPaused, mpNft, rpcChainId] =
      await Promise.all([
        gateway.getContractVersion(),
        gateway.hasRole("MINTER", gateway.backendAddress),
        gateway.hasRole("EVOLVER", gateway.backendAddress),
        gateway.getMarketplaceVersion(),
        gateway.isMarketplacePaused(),
        gateway.getMarketplaceMonsterNFT(),
        gateway.getRpcChainId(),
      ]);
    const marketplaceMisconfigured =
      mpNft.toLowerCase() !== gateway.contractAddress.toLowerCase();
    const chainMisconfigured = rpcChainId !== gateway.chainId;
    return NextResponse.json({
      connected: true,
      chainId: gateway.chainId,
      rpcChainId,
      chainMisconfigured,
      contractAddress: gateway.contractAddress,
      contractVersion: version,
      backendAddress: gateway.backendAddress,
      minterRole: minter,
      evolverRole: evolver,
      marketplaceAddress: gateway.marketplaceAddress,
      marketplaceVersion: mpVersion,
      marketplacePaused: mpPaused,
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
