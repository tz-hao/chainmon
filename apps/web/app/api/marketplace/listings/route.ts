import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import {
  getForSaleListings,
  getMyListings,
} from "@/lib/services/marketplace-service";
import { getChainGateway } from "@/lib/web3";
import { requireAuthenticatedTrainer, TrainerSessionError } from "@/lib/auth/trainer-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestedTrainerId = new URL(request.url).searchParams.get("trainerId");
  try {
    const repository = await getRepository();
    const gateway = getChainGateway();
    let trainerId: string | null = null;
    if (requestedTrainerId) {
      trainerId = await requireAuthenticatedTrainer(repository);
      if (trainerId !== requestedTrainerId) {
        return NextResponse.json({ error: "Wallet session does not match this trainer." }, { status: 403 });
      }
    }
    const listings = trainerId
      ? await getMyListings(repository, trainerId)
      : await getForSaleListings(repository, gateway);
    return NextResponse.json({
      listings: listings.map((l) => ({
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
      })),
    });
  } catch (error) {
    if (error instanceof TrainerSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Marketplace temporarily unavailable." },
      { status: 503 },
    );
  }
}
