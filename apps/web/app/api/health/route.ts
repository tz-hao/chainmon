import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChainGateway } from "@/lib/web3";
import {
  CHAINMON_CHAIN_ID,
  MONSTER_MARKETPLACE_ADDRESS,
  MONSTER_NFT_ADDRESS,
} from "@/lib/web3/chain";

export const dynamic = "force-dynamic";

/**
 * Aggregate health endpoint (Phase 9): app / database / rpc / contracts.
 * Never leaks secrets (no DATABASE_URL, no private keys, no passwords).
 *
 * Returns HTTP 200 when the app is up (even if dependencies are down —
 * each dependency carries its own status so operators can alert per piece).
 */
export async function GET() {
  const checks: Record<string, unknown> = {};

  // --- Database ---
  let dbStatus = "unavailable";
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "ok";
  } catch {
    dbStatus = "unavailable";
  }
  checks.database = { status: dbStatus };

  // --- RPC / contracts ---
  let web3: Record<string, unknown> = { status: "unavailable" };
  try {
    const gateway = getChainGateway();
    const [version, mpVersion, mpPaused, mpNft, minter, evolver] =
      await Promise.all([
        gateway.getContractVersion(),
        gateway.getMarketplaceVersion(),
        gateway.isMarketplacePaused(),
        gateway.getMarketplaceMonsterNFT(),
        gateway.hasRole("MINTER", gateway.backendAddress),
        gateway.hasRole("EVOLVER", gateway.backendAddress),
      ]);
    web3 = {
      status: "ok",
      chainId: gateway.chainId,
      rpc: "ok",
      monsterNFT: {
        address: gateway.contractAddress,
        version,
      },
      marketplace: {
        address: gateway.marketplaceAddress,
        version: mpVersion,
        paused: mpPaused,
        monsterNFT: mpNft,
      },
      backend: {
        address: gateway.backendAddress,
        minterRole: minter,
        evolverRole: evolver,
      },
    };
  } catch {
    web3 = { status: "unavailable" };
  }

  const overall =
    dbStatus === "ok" && web3.status === "ok" ? "ok" : "degraded";

  return NextResponse.json({
    status: overall,
    app: "ok",
    timestamp: new Date().toISOString(),
    checks,
    web3,
    config: {
      chainId: CHAINMON_CHAIN_ID,
      monsterNFT: MONSTER_NFT_ADDRESS || null,
      marketplace: MONSTER_MARKETPLACE_ADDRESS || null,
    },
  });
}
