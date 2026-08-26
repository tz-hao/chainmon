import marketplaceAbi from "../../../../contracts/abis/MonsterMarketplace.json";
import type { Monster } from "@chainmon/shared";
import { decodeEventLog, decodeFunctionData, type Abi } from "viem";
import type {
  GameRepository,
  MarketplaceListingRecord,
  MarketplaceListingWithMonster,
} from "@/lib/data";
import type { ChainGateway } from "@/lib/web3/chain-gateway";

const MARKETPLACE_ABI = marketplaceAbi.abi as Abi;

export class MarketplaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketplaceError";
  }
}

type MarketplaceMethod = "listMonster" | "cancelListing" | "buyMonster";

interface MarketplaceTransactionExpectation {
  method: MarketplaceMethod;
  tokenId: bigint;
  from: string;
  price?: bigint;
  seller?: string;
}

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

/**
 * Check the submitted wallet transaction itself, then (when mined) its
 * receipt event. A tx hash is never treated as proof by itself.
 */
async function validateMarketplaceTransaction(
  gateway: ChainGateway,
  txHash: string,
  expected: MarketplaceTransactionExpectation,
) {
  const transaction = await gateway.getTransaction(txHash as `0x${string}`);
  if (!transaction) throw new MarketplaceError("Marketplace transaction was not found.");
  if (!transaction.to || !sameAddress(transaction.to, gateway.marketplaceAddress)) {
    throw new MarketplaceError("Transaction was not sent to the marketplace contract.");
  }
  if (!sameAddress(transaction.from, expected.from)) {
    throw new MarketplaceError("Transaction sender does not match the verified wallet.");
  }
  let decoded: { functionName: string; args?: readonly unknown[] };
  try {
    decoded = decodeFunctionData({ abi: MARKETPLACE_ABI, data: transaction.input });
  } catch {
    throw new MarketplaceError("Transaction calldata is not a marketplace action.");
  }
  if (decoded.functionName !== expected.method || BigInt(decoded.args?.[0] as bigint) !== expected.tokenId) {
    throw new MarketplaceError("Transaction calldata does not match this listing.");
  }
  if (expected.method === "listMonster") {
    if (transaction.value !== 0n || BigInt(decoded.args?.[1] as bigint) !== expected.price) {
      throw new MarketplaceError("Listing transaction price does not match.");
    }
  } else if (expected.method === "buyMonster") {
    if (transaction.value !== expected.price) {
      throw new MarketplaceError("Purchase transaction value does not match the listing price.");
    }
  } else if (transaction.value !== 0n) {
    throw new MarketplaceError("Cancellation transaction must not transfer native currency.");
  }

  const receipt = await gateway.getTransactionReceipt(txHash as `0x${string}`);
  if (!receipt || receipt.status === "reverted") return receipt;
  const eventName = expected.method === "listMonster"
    ? "MonsterListed"
    : expected.method === "cancelListing"
      ? "ListingCancelled"
      : "MonsterSold";
  const eventMatches = receipt.logs.some((log) => {
    if (!sameAddress(log.address, gateway.marketplaceAddress)) return false;
    try {
      const decodedLog = decodeEventLog({
        abi: MARKETPLACE_ABI,
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      if (decodedLog.eventName !== eventName) return false;
      const args = decodedLog.args as {
        tokenId?: bigint;
        seller?: string;
        buyer?: string;
        price?: bigint;
      };
      if (args.tokenId !== expected.tokenId) return false;
      if (expected.seller && (!args.seller || !sameAddress(args.seller, expected.seller))) return false;
      if (expected.method === "buyMonster" && (!args.buyer || !sameAddress(args.buyer, expected.from))) return false;
      return expected.price === undefined || args.price === expected.price;
    } catch {
      return false;
    }
  });
  if (!eventMatches) {
    throw new MarketplaceError("Transaction receipt is missing the expected marketplace event.");
  }
  return receipt;
}

/** Normalize wallet-tx errors into short readable messages (Phase 8). */
export function normalizeMarketplaceError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes("user rejected") || lower.includes("user denied")) {
    return "Transaction cancelled.";
  }
  if (lower.includes("insufficient funds")) {
    return "Insufficient ETH balance.";
  }
  if (lower.includes("execution reverted") || lower.includes("contractfunction")) {
    return "The transaction was rejected by the contract.";
  }
  if (lower.includes("rpc") || lower.includes("network")) {
    return "Blockchain RPC unavailable. Please try again.";
  }
  return message;
}

export async function requireVerifiedWallet(
  repository: GameRepository,
  trainerId: string,
): Promise<string> {
  const wallet = await repository.getVerifiedWallet(trainerId);
  if (!wallet) {
    throw new MarketplaceError(
      "Verify a wallet first (signature only — no gas).",
    );
  }
  return wallet;
}

/**
 * Seller eligibility: MINT_CONFIRMED + verified wallet + on-chain owner.
 */
export async function validateSellerEligibility(
  repository: GameRepository,
  gateway: ChainGateway,
  trainerId: string,
  monsterId: string,
): Promise<{ monster: Monster; wallet: string; tokenId: string }> {
  // Explicit public read is safe here because ownership is checked immediately
  // below; scoped reads remain mandatory for ordinary collection operations.
  const monster = await repository.getMonsterPublic(monsterId);
  if (!monster) throw new MarketplaceError("Monster not found.");
  if (monster.owner !== trainerId) {
    throw new MarketplaceError("You don't own this monster.");
  }
  if (monster.mintStatus !== "MINT_CONFIRMED" || !monster.tokenId) {
    throw new MarketplaceError("Claim NFT before selling.");
  }
  const wallet = await requireVerifiedWallet(repository, trainerId);
  const owner = (await gateway.getOwner(BigInt(monster.tokenId))).toLowerCase();
  if (owner !== wallet) {
    throw new MarketplaceError("You don't own this NFT on-chain.");
  }
  return { monster, wallet, tokenId: monster.tokenId };
}

/**
 * LIST flow (user wallet signs listMonster; server tracks the state):
 *  PENDING(+txHash) → receipt → ACTIVE | STALE | FAILED (receipt timeout keeps PENDING)
 */
export async function listMonster(
  repository: GameRepository,
  gateway: ChainGateway,
  trainerId: string,
  monsterId: string,
  txHash: string,
  priceWei: string,
): Promise<MarketplaceListingRecord> {
  const { monster, tokenId, wallet } = await validateSellerEligibility(
    repository,
    gateway,
    trainerId,
    monsterId,
  );

  const existing = await repository.getListingByMonster(monsterId);
  if (
    existing &&
    !["CANCELLED", "STALE", "FAILED"].includes(existing.status)
  ) {
    throw new MarketplaceError("This monster already has a listing.");
  }

  // Reject a valid-looking hash before it can create or advance a listing.
  await validateMarketplaceTransaction(gateway, txHash, {
    method: "listMonster",
    tokenId: BigInt(tokenId),
    from: wallet,
    seller: wallet,
    price: BigInt(priceWei),
  });

  const listing =
    existing ??
    (await repository.createListing(monsterId, trainerId, {
      tokenId,
      priceWei,
      chainId: gateway.chainId,
      nftContractAddress: gateway.contractAddress,
      marketplaceAddress: gateway.marketplaceAddress,
    }));

  await repository.updateListingStatus(listing.id, {
    status: "PENDING",
    txHash,
  });

  return settleListing(repository, gateway, monsterId);
}

/** Receipt-driven listing settlement (timeout keeps PENDING). */
async function settleListing(
  repository: GameRepository,
  gateway: ChainGateway,
  monsterId: string,
): Promise<MarketplaceListingRecord> {
  const listing = await repository.getListingByMonster(monsterId);
  if (!listing || !listing.listingTxHash || !listing.tokenId) {
    throw new MarketplaceError("Listing not found.");
  }
  const receipt = await gateway.getTransactionReceipt(
    listing.listingTxHash as `0x${string}`,
  );
  if (receipt === null) return listing; // pending — keep PENDING
  if (receipt.status === "reverted") {
    await repository.updateListingStatus(listing.id, { status: "FAILED" });
    return { ...listing, status: "FAILED" };
  }

  const sellerWallet = await requireVerifiedWallet(repository, listing.sellerId);
  await validateMarketplaceTransaction(gateway, listing.listingTxHash, {
    method: "listMonster",
    tokenId: BigInt(listing.tokenId),
    from: sellerWallet,
    seller: sellerWallet,
    price: BigInt(listing.priceWei),
  });

  const chainListing = await gateway.getMarketplaceListing(
    BigInt(listing.tokenId),
  );
  if (!chainListing.active) {
    // Listed tx succeeded but the chain listing is gone (cancelled/sold
    // elsewhere) — mark STALE; a later reconcile refines it.
    await repository.updateListingStatus(listing.id, { status: "STALE" });
    return { ...listing, status: "STALE" };
  }
  if (!sameAddress(chainListing.seller, sellerWallet) || chainListing.price !== BigInt(listing.priceWei)) {
    await repository.updateListingStatus(listing.id, { status: "STALE" });
    return { ...listing, status: "STALE" };
  }
  await repository.updateListingStatus(listing.id, { status: "ACTIVE" });
  return { ...listing, status: "ACTIVE" };
}

/**
 * CANCEL flow: ACTIVE → CANCEL_PENDING(+txHash) → receipt → CANCELLED.
 */
export async function cancelListing(
  repository: GameRepository,
  gateway: ChainGateway,
  trainerId: string,
  monsterId: string,
  txHash: string,
): Promise<MarketplaceListingRecord> {
  const listing = await repository.getListingByMonster(monsterId);
  if (!listing) throw new MarketplaceError("Listing not found.");
  if (listing.sellerId !== trainerId) {
    throw new MarketplaceError("You can only cancel your own listings.");
  }
  if (listing.status !== "ACTIVE") {
    throw new MarketplaceError("This listing is not active.");
  }
  const sellerWallet = await requireVerifiedWallet(repository, trainerId);
  await validateMarketplaceTransaction(gateway, txHash, {
    method: "cancelListing",
    tokenId: BigInt(listing.tokenId ?? "0"),
    from: sellerWallet,
    seller: sellerWallet,
  });
  await repository.updateListingStatus(listing.id, {
    status: "CANCEL_PENDING",
    txHash,
  });

  const receipt = await gateway.getTransactionReceipt(
    txHash as `0x${string}`,
  );
  if (receipt === null) return { ...listing, status: "CANCEL_PENDING" };
  if (receipt.status === "reverted") {
    await repository.updateListingStatus(listing.id, { status: "FAILED" });
    return { ...listing, status: "FAILED" };
  }
  const chainListing = await gateway.getMarketplaceListing(BigInt(listing.tokenId ?? "0"));
  if (chainListing.active) {
    await repository.updateListingStatus(listing.id, { status: "STALE" });
    return { ...listing, status: "STALE" };
  }
  await repository.updateListingStatus(listing.id, {
    status: "CANCELLED",
    cancelAt: new Date(),
  });
  return { ...listing, status: "CANCELLED" };
}

/**
 * BUY flow: ACTIVE → SALE_PENDING(+txHash, buyer) → receipt → ownerOf check
 * → SOLD + ownership sync (monster moves to the buyer's collection).
 * The buyer wallet must be the trainer's verified wallet.
 */
export async function confirmSale(
  repository: GameRepository,
  gateway: ChainGateway,
  trainerId: string,
  monsterId: string,
  txHash: string,
  buyerWallet: string,
): Promise<MarketplaceListingRecord> {
  const verified = await requireVerifiedWallet(repository, trainerId);
  if (buyerWallet.toLowerCase() !== verified) {
    throw new MarketplaceError(
      "The buyer wallet does not match your verified wallet.",
    );
  }
  const listing = await repository.getListingByMonster(monsterId);
  if (!listing) throw new MarketplaceError("Listing not found.");
  if (listing.status !== "ACTIVE") {
    throw new MarketplaceError("This listing is not active.");
  }
  if (!listing.tokenId) throw new MarketplaceError("Listing has no token id.");
  const sellerWallet = await requireVerifiedWallet(repository, listing.sellerId);
  await validateMarketplaceTransaction(gateway, txHash, {
    method: "buyMonster",
    tokenId: BigInt(listing.tokenId),
    from: verified,
    seller: sellerWallet,
    price: BigInt(listing.priceWei),
  });
  await repository.updateListingStatus(listing.id, {
    status: "SALE_PENDING",
    txHash,
    buyerWallet: buyerWallet.toLowerCase(),
  });

  const receipt = await gateway.getTransactionReceipt(txHash as `0x${string}`);
  if (receipt === null) return { ...listing, status: "SALE_PENDING" };
  if (receipt.status === "reverted") {
    await repository.updateListingStatus(listing.id, { status: "FAILED" });
    return { ...listing, status: "FAILED" };
  }

  // Verify the purchase actually moved the NFT to the buyer.
  const owner = (await gateway.getOwner(BigInt(listing.tokenId))).toLowerCase();
  if (owner !== buyerWallet.toLowerCase()) {
    await repository.updateListingStatus(listing.id, { status: "STALE" });
    return { ...listing, status: "STALE" };
  }

  await repository.updateListingStatus(listing.id, {
    status: "SOLD",
    soldAt: new Date(),
  });

  // Ownership sync: monster leaves the seller and joins the buyer's trainer.
  await syncSoldOwnership(repository, gateway, monsterId);
  return { ...listing, status: "SOLD" };
}

/** Move the sold monster to the buyer's trainer (wallet → trainer mapping). */
async function syncSoldOwnership(
  repository: GameRepository,
  gateway: ChainGateway,
  monsterId: string,
): Promise<void> {
  const { syncMonsterOwnership } = await import("./ownership-sync-service");
  await syncMonsterOwnership(repository, gateway, monsterId);
}

/**
 * Listing reconciliation against the chain (source of truth):
 * DB ACTIVE but chain listing inactive → STALE (or SOLD when owner changed).
 */
export async function reconcileListing(
  repository: GameRepository,
  gateway: ChainGateway,
  monsterId: string,
): Promise<MarketplaceListingRecord | null> {
  const listing = await repository.getListingByMonster(monsterId);
  if (!listing || !listing.tokenId) return listing;
  if (!["ACTIVE", "PENDING", "CANCEL_PENDING", "SALE_PENDING"].includes(listing.status)) {
    return listing;
  }

  const chainListing = await gateway.getMarketplaceListing(
    BigInt(listing.tokenId),
  );
  if (chainListing.active) {
    if (listing.status !== "ACTIVE") {
      await repository.updateListingStatus(listing.id, { status: "ACTIVE" });
      return { ...listing, status: "ACTIVE" };
    }
    return listing;
  }

  // Chain listing gone: distinguish sold vs stale via the recorded buyer.
  const owner = (await gateway.getOwner(BigInt(listing.tokenId))).toLowerCase();
  if (listing.buyerWallet && owner === listing.buyerWallet.toLowerCase()) {
    await repository.updateListingStatus(listing.id, {
      status: "SOLD",
      soldAt: new Date(),
    });
    return { ...listing, status: "SOLD" };
  }
  await repository.updateListingStatus(listing.id, { status: "STALE" });
  return { ...listing, status: "STALE" };
}

export async function getForSaleListings(
  repository: GameRepository,
  gateway: ChainGateway,
): Promise<MarketplaceListingWithMonster[]> {
  const listings = await repository.listActiveListings();
  const reconciled: MarketplaceListingWithMonster[] = [];
  for (const listing of listings) {
    try {
      const current = await reconcileListing(repository, gateway, listing.monsterId);
      if (current?.status === "ACTIVE") {
        reconciled.push({ ...current, monster: listing.monster });
      }
    } catch {
      // RPC down → keep DB ACTIVE listings visible but flag unavailable upstream
      reconciled.push(listing);
    }
  }
  return reconciled;
}

export async function getMyListings(
  repository: GameRepository,
  trainerId: string,
): Promise<MarketplaceListingWithMonster[]> {
  return repository.listTrainerListings(trainerId);
}

/** Gameplay lock: an ACTIVE listing freezes team / battle / evolution. */
export async function assertNotListed(
  repository: GameRepository,
  monsterId: string,
): Promise<void> {
  const listing = await repository.getActiveListingByMonster(monsterId);
  if (listing) {
    throw new MarketplaceError(
      "This monster is listed for sale — cancel the listing first.",
    );
  }
}
