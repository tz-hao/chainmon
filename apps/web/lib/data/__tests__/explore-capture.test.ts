import { generateMonster, resetRandomSource, setRandomSource, type RandomSource } from "@chainmon/game-engine";
import { getSpeciesBySlug } from "@chainmon/monster-data";
import { beforeEach, describe, expect, it } from "vitest";
import { createTrainerWithStarter } from "../demo-service";
import { memoryRepository, resetMemoryRepository } from "../memory-repository";
import { fleeEncounter, throwBall } from "../../services/capture-service";
import { exploreRegion } from "../../services/explore-service";
import type { GameRepository } from "../types";

/**
 * Scripted random source: returns values in order, then repeats the last one.
 * RNG call sequence in the tests below:
 *  - createTrainerWithStarter → 5 calls (starter DNA)
 *  - exploreRegion            → 1 call  (weighted species pick)
 *  - throwBall                → 1 call  (capture roll)
 *  - capture success          → 5 calls (captured monster DNA)
 */
function scripted(values: number[]): RandomSource {
  let index = 0;
  return {
    next: () => {
      const value = values[index] ?? values[values.length - 1] ?? 0.5;
      index += 1;
      return value;
    },
  };
}

const STARTER_DNA = [0.5, 0.5, 0.5, 0.5, 0.5];

let repository: GameRepository;

beforeEach(() => {
  resetMemoryRepository();
  resetRandomSource();
  repository = memoryRepository;
});

async function createTrainer() {
  const { trainer } = await createTrainerWithStarter(
    repository,
    "Ash",
    "firecub",
  );
  return trainer;
}

async function inventoryFor(trainerId: string) {
  return repository.getInventory(trainerId);
}

describe("starter inventory", () => {
  it("grants Basic 20 / Great 5 / Ultra 2 exactly once", async () => {
    const trainer = await createTrainer();
    let inventory = await inventoryFor(trainer.id);
    const qty = (slug: string) =>
      inventory.find((i) => i.slug === slug)?.quantity ?? 0;
    expect(qty("basic-ball")).toBe(20);
    expect(qty("great-ball")).toBe(5);
    expect(qty("ultra-ball")).toBe(2);

    // Repeated login (createDemoTrainer again) must NOT re-grant.
    const trainerAgain = await repository.createDemoTrainer("Ash");
    expect(trainerAgain.id).toBe(trainer.id);
    inventory = await inventoryFor(trainer.id);
    expect(qty("basic-ball")).toBe(20);
    expect(qty("great-ball")).toBe(5);
    expect(qty("ultra-ball")).toBe(2);
  });
});

describe("explore", () => {
  it("creates an ACTIVE encounter with a species from the region", async () => {
    setRandomSource(scripted([...STARTER_DNA, 0]));
    const trainer = await createTrainer();

    const encounter = await exploreRegion(repository, trainer.id, "forest");
    expect(encounter.status).toBe("active");
    expect(encounter.regionId).toBe("forest");
    expect(encounter.speciesId).toBe(11); // roll 0 → first entry: LeafCat
    expect(encounter.currentHp).toBe(encounter.maxHp);
    expect(encounter.trainerId).toBe(trainer.id);
  });

  it("reuses the existing ACTIVE encounter instead of creating a new one", async () => {
    setRandomSource(scripted([...STARTER_DNA, 0]));
    const trainer = await createTrainer();

    const first = await exploreRegion(repository, trainer.id, "forest");
    const second = await exploreRegion(repository, trainer.id, "forest");
    expect(second.id).toBe(first.id);
  });

  it("rejects unknown regions with a readable error", async () => {
    const trainer = await createTrainer();
    await expect(
      exploreRegion(repository, trainer.id, "moon"),
    ).rejects.toThrow(/Region not found/);
  });
});

describe("capture — full success chain", () => {
  it("captures: ball -1, monster +1, encounter CAPTURED", async () => {
    // roll for encounter pick = 0 → LeafCat (catchRate 0.55); capture roll = 0.01 → success
    setRandomSource(scripted([...STARTER_DNA, 0, 0.01]));
    const trainer = await createTrainer();
    const encounter = await exploreRegion(repository, trainer.id, "forest");

    const outcome = await throwBall(repository, {
      trainerId: trainer.id,
      encounterId: encounter.id,
      ballSlug: "basic-ball",
    });
    expect(outcome.outcome).toBe("captured");
    if (outcome.outcome !== "captured") return;
    expect(outcome.chance).toBeCloseTo(0.55, 5);
    expect(outcome.monster.speciesId).toBe(11);
    expect(outcome.monster.owner).toBe(trainer.id);

    // Basic Capsule 20 → 19
    const inventory = await inventoryFor(trainer.id);
    expect(
      inventory.find((i) => i.slug === "basic-ball")?.quantity,
    ).toBe(19);

    // Collection: starter + captured
    const monsters = await repository.listMonsters();
    expect(monsters).toHaveLength(2);

    // Encounter CAPTURED
    const stored = await repository.getEncounterById(encounter.id);
    expect(stored?.status).toBe("captured");

    // Captured monster readable by id
    const fetched = await repository.getMonster(outcome.monster.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe("LeafCat");
  });
});

describe("capture — failure chain", () => {
  it("keeps encounter ACTIVE, ball -1, no monster added", async () => {
    setRandomSource(scripted([...STARTER_DNA, 0, 0.99]));
    const trainer = await createTrainer();
    const encounter = await exploreRegion(repository, trainer.id, "forest");

    const outcome = await throwBall(repository, {
      trainerId: trainer.id,
      encounterId: encounter.id,
      ballSlug: "basic-ball",
    });
    expect(outcome.outcome).toBe("failed");

    const inventory = await inventoryFor(trainer.id);
    expect(
      inventory.find((i) => i.slug === "basic-ball")?.quantity,
    ).toBe(19);
    expect(await repository.listMonsters()).toHaveLength(1);
    const stored = await repository.getEncounterById(encounter.id);
    expect(stored?.status).toBe("active");
  });
});

describe("capture — duplicate protection", () => {
  it("commits only one simultaneous ACTIVE capture and creates one monster", async () => {
    const trainer = await createTrainer();
    const encounter = await exploreRegion(repository, trainer.id, "forest");
    const species = getSpeciesBySlug("leafcat")!;
    const [first, second] = await Promise.all([
      repository.commitCapture({
        encounterId: encounter.id,
        trainerId: trainer.id,
        itemSlug: "basic-ball",
        monster: generateMonster(species, { owner: trainer.id }),
      }),
      repository.commitCapture({
        encounterId: encounter.id,
        trainerId: trainer.id,
        itemSlug: "basic-ball",
        monster: generateMonster(species, { owner: trainer.id }),
      }),
    ]);
    expect([first, second].filter((result) => result === "captured")).toHaveLength(1);
    expect(await repository.listMonsters()).toHaveLength(2);
  });

  it("rejects a second capture: no extra monster, no extra ball cost", async () => {
    setRandomSource(scripted([...STARTER_DNA, 0, 0.01]));
    const trainer = await createTrainer();
    const encounter = await exploreRegion(repository, trainer.id, "forest");

    const first = await throwBall(repository, {
      trainerId: trainer.id,
      encounterId: encounter.id,
      ballSlug: "basic-ball",
    });
    expect(first.outcome).toBe("captured");

    await expect(
      throwBall(repository, {
        trainerId: trainer.id,
        encounterId: encounter.id,
        ballSlug: "basic-ball",
      }),
    ).rejects.toThrow(/already captured/);

    const inventory = await inventoryFor(trainer.id);
    expect(
      inventory.find((i) => i.slug === "basic-ball")?.quantity,
    ).toBe(19);
    expect(await repository.listMonsters()).toHaveLength(2);
    const stored = await repository.getEncounterById(encounter.id);
    expect(stored?.status).toBe("captured");
  });
});

describe("capture — flee", () => {
  it("marks the encounter FLED and blocks later captures", async () => {
    const trainer = await createTrainer();
    const encounter = await exploreRegion(repository, trainer.id, "forest");

    await fleeEncounter(repository, trainer.id, encounter.id);
    expect(
      (await repository.getEncounterById(encounter.id))?.status,
    ).toBe("fled");

    await expect(
      throwBall(repository, {
        trainerId: trainer.id,
        encounterId: encounter.id,
        ballSlug: "basic-ball",
      }),
    ).rejects.toThrow(/fled/);
    expect(await repository.listMonsters()).toHaveLength(1);
  });
});

describe("capture — validation & inventory limits", () => {
  it("rejects unknown encounters and foreign encounters", async () => {
    const trainer = await createTrainer();
    await expect(
      throwBall(repository, {
        trainerId: trainer.id,
        encounterId: "nope",
        ballSlug: "basic-ball",
      }),
    ).rejects.toThrow(/Encounter not found/);

    const encounter = await exploreRegion(repository, trainer.id, "forest");
    await expect(
      throwBall(repository, {
        trainerId: "some-other-trainer",
        encounterId: encounter.id,
        ballSlug: "basic-ball",
      }),
    ).rejects.toThrow(/does not belong to you/);
  });

  it("rejects unknown balls", async () => {
    const trainer = await createTrainer();
    const encounter = await exploreRegion(repository, trainer.id, "forest");
    await expect(
      throwBall(repository, {
        trainerId: trainer.id,
        encounterId: encounter.id,
        ballSlug: "master-ball",
      }),
    ).rejects.toThrow(/Unknown capture ball/);
  });

  it("refuses to capture with zero balls (consumeItem returns false)", async () => {
    const trainer = await createTrainer();
    // Burn all 20 basic capsules
    for (let i = 0; i < 20; i++) {
      expect(
        await repository.consumeItem(trainer.id, "basic-ball"),
      ).toBe(true);
    }
    expect(
      await repository.consumeItem(trainer.id, "basic-ball"),
    ).toBe(false);

    const encounter = await exploreRegion(repository, trainer.id, "forest");
    await expect(
      throwBall(repository, {
        trainerId: trainer.id,
        encounterId: encounter.id,
        ballSlug: "basic-ball",
      }),
    ).rejects.toThrow(/don't have any of that ball/);
  });
});

