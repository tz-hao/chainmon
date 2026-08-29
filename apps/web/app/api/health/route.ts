import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getReadOnlyChainHealth } from "@/lib/web3/read-only-health";
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
    const health = await getReadOnlyChainHealth();
    web3 = {
      status: "ok",
      chainId: health.chainId,
      rpc: "ok",
      monsterNFT: {
        address: health.contractAddress,
        version: health.contractVersion,
      },
      marketplace: {
        address: health.marketplaceAddress,
        version: health.marketplaceVersion,
        paused: health.marketplacePaused,
        monsterNFT: health.marketplaceMonsterNFT,
      },
      backend: {
        writesEnabled: health.backendAddress !== null,
        address: health.backendAddress,
        minterRole: health.minterRole,
        evolverRole: health.evolverRole,
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
