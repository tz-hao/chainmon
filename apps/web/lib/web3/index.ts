import type { ChainGateway } from "./chain-gateway";
import { ViemChainGateway } from "./server-client";

let cachedGateway: ChainGateway | null = null;

/**
 * Production gateway (server-side only). Throws Web3Error("config") when
 * the contract address / minter key are not configured — callers degrade
 * gracefully (e.g. "Blockchain temporarily unavailable").
 */
export function getChainGateway(): ChainGateway {
  cachedGateway ??= new ViemChainGateway();
  return cachedGateway;
}

export type { ChainGateway };
export { Web3Error } from "./chain-gateway";
