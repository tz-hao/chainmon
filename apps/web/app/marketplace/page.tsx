import { MarketplacePage, type ListingView } from "@/components/MarketplacePage";
import { PageHeader } from "@/components/PageHeader";
import { requirePageTrainer } from "@/lib/auth/current-trainer";
import { NATIVE_CURRENCY_SYMBOL } from "@/lib/web3/chain";

export const dynamic = "force-dynamic";

export default async function MarketplaceRoute() {
  const { repository } = await requirePageTrainer();

  let initialListings: ListingView[] = [];
  try {
    // Server-side initial load; failures degrade to "unavailable" in the UI.
    const { getForSaleListings } = await import(
      "@/lib/services/marketplace-service"
    );
    const gateway = (await import("@/lib/web3")).getChainGateway();
    const listings = await getForSaleListings(repository, gateway);
    initialListings = listings.map((l) => ({
      ...l,
      priceEth: (BigInt(l.priceWei) / 10n ** 18n).toString(),
      monster: {
        id: l.monster.id,
        tokenId: l.monster.tokenId,
        speciesId: l.monster.speciesId,
        name: l.monster.name,
        element: l.monster.element,
        rarity: l.monster.rarity,
        level: l.monster.level,
        hp: l.monster.hp,
        attack: l.monster.attack,
        defense: l.monster.defense,
        speed: l.monster.speed,
        generation: l.monster.generation,
        wins: l.monster.wins,
        battleCount: l.monster.battleCount,
      },
    }));
  } catch {
    initialListings = [];
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Marketplace"
        subtitle={`Trade monster NFTs for fixed ${NATIVE_CURRENCY_SYMBOL}. Non-custodial, 0% platform fee.`}
        badge="Phase 8"
      />
      <MarketplacePage initialListings={initialListings} />
    </div>
  );
}
