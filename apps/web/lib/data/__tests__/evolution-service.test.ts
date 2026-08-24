import {
  calculateMonsterStats,
  generateMonster,
  resetRandomSource,
  setRandomSource,
} from "@chainmon/game-engine";
import { getSpeciesBySlug } from "@chainmon/monster-data";
import { beforeEach, describe, expect, it } from "vitest";
import { createTrainerWithStarter } from "../demo-service";
import { memoryRepository, resetMemoryRepository } from "../memory-repository";
import type { GameRepository } from "../types";
import { EvolutionError, evolveMonster } from "../../services/evolution-service";
import { createBattle, saveBattleTeam, submitBattleAction } from "../../services/battle-service";

let repository: GameRepository;

beforeEach(() => {
  resetMemoryRepository();
  resetRandomSource();
  repository = memoryRepository;
});

async function addMonsterToTrainer(
  trainerId: string,
  speciesSlug: string,
  level: number,
  exp = 0,
) {
  const species = getSpeciesBySlug(speciesSlug);
  if (!species) throw new Error(`fixture: ${speciesSlug} missing`);
  const monster = generateMonster(species, { owner: trainerId });
  monster.level = level;
  monster.exp = exp;
  await repository.addMonster(monster);
  return monster;
}

describe("evolveMonster — level-only evolution (FireCub → FireWolf)", () => {
  it("rejects FireCub below level 16 with a readable error", async () => {
    const { trainer } = await createTrainerWithStarter(repository, "Ash", "firecub");
    const cub = await addMonsterToTrainer(trainer.id, "firecub", 15);
    await expect(
      evolveMonster(repository, trainer.id, cub.id),
    ).rejects.toThrow(/Level 16/);
  });

  it("evolves FireCub at level 16: species changes, DNA & identity preserved", async () => {
    const { trainer } = await createTrainerWithStarter(repository, "Ash", "firecub");
    const cub = await addMonsterToTrainer(trainer.id, "firecub", 16);
    const dnaBefore = cub.dna;
    const idBefore = cub.id;
    const ownerBefore = cub.owner;
    const generationBefore = cub.generation;
    const battleCountBefore = cub.battleCount;
    const winsBefore = cub.wins;

    const { monster, history } = await evolveMonster(repository, trainer.id, cub.id);

    expect(monster.speciesId).toBe(2); // FireWolf
    expect(monster.name).toBe("FireWolf");
    expect(monster.rarity).toBe("rare");
    expect(monster.dna).toEqual(dnaBefore); // DNA preserved
    expect(monster.id).toBe(idBefore); // identity preserved
    expect(monster.owner).toBe(ownerBefore);
    expect(monster.generation).toBe(generationBefore);
    expect(monster.battleCount).toBe(battleCountBefore);
    expect(monster.wins).toBe(winsBefore);

    // Stats recalculated from the target species + same DNA + level
    const fireWolf = getSpeciesBySlug("firewolf")!;
    const expected = calculateMonsterStats(fireWolf, dnaBefore, 16);
    expect(monster.hp).toBe(expected.hp);
    expect(monster.attack).toBe(expected.attack);
    expect(monster.defense).toBe(expected.defense);
    expect(monster.speed).toBe(expected.speed);

    // History recorded
    expect(history.fromSpeciesId).toBe(1);
    expect(history.toSpeciesId).toBe(2);
    expect(history.level).toBe(16);
    const stored = await repository.getEvolutionHistory(cub.id);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.toSpeciesId).toBe(2);
  });
});

describe("evolveMonster — item evolution (FireWolf → InfernoWolf)", () => {
  async function setupFireWolfWithStone(stoneCount: number) {
    const { trainer } = await createTrainerWithStarter(repository, "Ash", "firecub");
    const wolf = await addMonsterToTrainer(trainer.id, "firewolf", 32);
    if (stoneCount > 0) {
      // Grant a Fire Stone via the atomic shop transaction (real path).
      await repository.purchaseShopItem(trainer.id, "fire-stone", stoneCount, 0);
    }
    return { trainer, wolf };
  }

  it("rejects FireWolf at 32 without a Fire Stone", async () => {
    const { trainer, wolf } = await setupFireWolfWithStone(0);
    await expect(
      evolveMonster(repository, trainer.id, wolf.id),
    ).rejects.toThrow(/Fire Stone/);
  });

  it("evolves FireWolf at 32 with a Fire Stone and consumes it", async () => {
    const { trainer, wolf } = await setupFireWolfWithStone(1);

    const { monster, history } = await evolveMonster(repository, trainer.id, wolf.id);
    expect(monster.speciesId).toBe(3); // InfernoWolf
    expect(monster.name).toBe("InfernoWolf");
    expect(monster.dna).toEqual(wolf.dna); // DNA preserved

    // Fire Stone consumed
    const inventory = await repository.getInventory(trainer.id);
    expect(inventory.find((i) => i.slug === "fire-stone")?.quantity ?? 0).toBe(0);

    expect(history.fromSpeciesId).toBe(2);
    expect(history.toSpeciesId).toBe(3);
  });

  it("rejects duplicate evolution: no extra stone cost, no extra history", async () => {
    const { trainer, wolf } = await setupFireWolfWithStone(1);
    await evolveMonster(repository, trainer.id, wolf.id);

    await expect(
      evolveMonster(repository, trainer.id, wolf.id),
    ).rejects.toThrow(/cannot evolve/);

    const inventory = await repository.getInventory(trainer.id);
    expect(inventory.find((i) => i.slug === "fire-stone")?.quantity ?? 0).toBe(0);
    const stored = await repository.getEvolutionHistory(wolf.id);
    expect(stored).toHaveLength(1);
  });

  it("rejects evolving a monster the trainer does not own", async () => {
    const { trainer } = await createTrainerWithStarter(repository, "Ash", "firecub");
    const cub = await addMonsterToTrainer(trainer.id, "firecub", 16);
    cub.owner = "someone-else";
    await expect(
      evolveMonster(repository, trainer.id, cub.id),
    ).rejects.toThrow(/don't own/);
  });
});
