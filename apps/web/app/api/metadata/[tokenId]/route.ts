import { NextResponse } from "next/server";
import { getEvolutionStage, getSpeciesById } from "@chainmon/monster-data";
import { getRepository } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Standard ERC-721 metadata endpoint.
 * Token id → Monster.tokenId (never the DB primary key).
 * Returns only stable asset fields — no dynamic level, no internal ids.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  const { tokenId } = await params;
  if (!/^\d+$/.test(tokenId)) {
    return NextResponse.json({ error: "Invalid token id." }, { status: 400 });
  }

  try {
    const repository = await getRepository();
    const monster = await repository.getMonsterByTokenId(tokenId);
    if (!monster || monster.mintStatus !== "MINT_CONFIRMED") {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const species = getSpeciesById(monster.speciesId);
    if (!species) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return NextResponse.json({
      name: `ChainMon ${species.name} #${monster.tokenId}`,
      description: species.description,
      image: `${appUrl}${species.image}`,
      attributes: [
        { trait_type: "Species", value: species.name },
        { trait_type: "Element", value: species.element },
        { trait_type: "Species Rarity", value: species.rarity },
        { trait_type: "Generation", value: monster.generation },
        { trait_type: "Evolution Stage", value: getEvolutionStage(species) },
      ],
    });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
