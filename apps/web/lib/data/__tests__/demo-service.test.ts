import { getSpeciesBySlug } from "@chainmon/monster-data";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createTrainerWithStarter,
  isStarterSlug,
  validateNickname,
} from "../demo-service";
import { memoryRepository, resetMemoryRepository } from "../memory-repository";

beforeEach(() => {
  resetMemoryRepository();
});

describe("validateNickname", () => {
  it("rejects too-short and too-long nicknames", () => {
    expect(validateNickname("a")).not.toBeNull();
    expect(validateNickname("x".repeat(21))).not.toBeNull();
    expect(validateNickname("Ash")).toBeNull();
  });

  it("trims whitespace", () => {
    expect(validateNickname("  Ash  ")).toBeNull();
  });
});

describe("isStarterSlug", () => {
  it("allows only the three starter species", () => {
    expect(isStarterSlug("firecub")).toBe(true);
    expect(isStarterSlug("aquaturtle")).toBe(true);
    expect(isStarterSlug("leafcat")).toBe(true);
    expect(isStarterSlug("sparkmouse")).toBe(false);
    expect(isStarterSlug("thunderbird")).toBe(false);
  });
});

describe("createTrainerWithStarter — the full Phase 2 chain", () => {
  it("creates trainer → generates starter → saves → reads back", async () => {
    const repository = memoryRepository;

    // 1. Create Trainer + generate & save the starter monster
    const { trainer, monster } = await createTrainerWithStarter(
      repository,
      "Ash",
      "firecub",
    );
    expect(trainer.nickname).toBe("Ash");
    expect(trainer.battleCount).toBe(0);
    expect(monster.speciesId).toBe(getSpeciesBySlug("firecub")?.id);
    expect(monster.name).toBe("FireCub");
    expect(monster.level).toBe(1);
    expect(monster.exp).toBe(0);
    expect(monster.generation).toBe(1);
    expect(monster.battleCount).toBe(0);
    expect(monster.owner).toBe(trainer.id);

    // 2. Collection contains the monster
    const monsters = await repository.listMonsters();
    expect(monsters).toHaveLength(1);
    expect(monsters[0]?.id).toBe(monster.id);

    // 3. Detail read works
    const fetched = await repository.getMonster(monster.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe("FireCub");
    expect(fetched?.dna).toBeDefined();
    expect(fetched?.skills.length).toBeGreaterThanOrEqual(2);

    // 4. Unknown id → null
    expect(await repository.getMonster("does-not-exist")).toBeNull();
  });

  it("reuses the trainer on repeat creation", async () => {
    const repository = memoryRepository;
    const first = await createTrainerWithStarter(repository, "Ash", "leafcat");
    const second = await createTrainerWithStarter(repository, "Misty", "leafcat");
    expect(second.trainer.id).toBe(first.trainer.id);
    const monsters = await repository.listMonsters();
    expect(monsters).toHaveLength(2);
  });

  it("rejects invalid starter slugs", async () => {
    await expect(
      createTrainerWithStarter(memoryRepository, "Ash", "thunderbird"),
    ).rejects.toThrow("Invalid starter monster");
  });

  it("rejects invalid nicknames", async () => {
    await expect(
      createTrainerWithStarter(memoryRepository, "x", "firecub"),
    ).rejects.toThrow("Nickname");
  });
});
