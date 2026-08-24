import {
  calculateMonsterStats,
  generateMonster,
  resetRandomSource,
  setRandomSource,
  type BattleState,
} from "@chainmon/game-engine";
import { getSpeciesBySlug } from "@chainmon/monster-data";
import { beforeEach, describe, expect, it } from "vitest";
import { createTrainerWithStarter } from "../demo-service";
import { memoryRepository, resetMemoryRepository } from "../memory-repository";
import type { GameRepository } from "../types";
import { createBattle, saveBattleTeam, submitBattleAction } from "../../services/battle-service";

let repository: GameRepository;

beforeEach(() => {
  resetMemoryRepository();
  resetRandomSource();
  repository = memoryRepository;
});

async function buildTeam(
  tweak?: (monsters: Awaited<ReturnType<GameRepository["listMonsters"]>>) => void,
) {
  const { trainer } = await createTrainerWithStarter(
    repository,
    "Ash",
    "firecub",
  );
  const second = generateMonster(getSpeciesBySlug("leafcat")!, {
    owner: trainer.id,
  });
  const third = generateMonster(getSpeciesBySlug("aquaturtle")!, {
    owner: trainer.id,
  });
  await repository.addMonster(second);
  await repository.addMonster(third);

  // First 3 collection monsters form the team (safe on repeated builds)
  const monsters = (await repository.listMonsters()).slice(0, 3);
  for (const m of monsters) {
    m.attack = 999;
    m.defense = 999;
  }
  if (tweak) tweak(monsters);

  const ids = monsters.map((m) => m.id);
  await saveBattleTeam(repository, trainer.id, ids);
  const battle = await createBattle(repository, trainer.id);
  return { trainer, battle, ids, monsters };
}

async function fightToCompletion(battle: BattleState, trainerId: string) {
  let current = battle;
  let turns = 0;
  let lastRewards = null as Awaited<ReturnType<typeof submitBattleAction>>["rewards"];
  while (current.status === "active" && turns < 50) {
    const result = await submitBattleAction(repository, {
      trainerId,
      battleId: battle.id,
      expectedTurn: current.turn,
      action: { type: "basic_attack" },
    });
    current = result.state;
    lastRewards = result.rewards;
    turns += 1;
  }
  return { state: current, rewards: lastRewards };
}

async function buildWeakTeam() {
  return buildTeam((mons) => {
    for (const m of mons) {
      m.hp = 1;
      m.attack = 1;
      m.defense = 1;
    }
  });
}

describe("battle rewards — EXP & gold", () => {
  it("victory grants EXP to exactly the 3 team monsters and gold to the trainer", async () => {
    const { trainer, battle } = await buildTeam();
    // A fourth monster outside the team must not receive EXP
    const outsider = generateMonster(getSpeciesBySlug("magmaboar")!, {
      owner: trainer.id,
    });
    await repository.addMonster(outsider);

    const goldBefore = trainer.gold;
    const { state, rewards } = await fightToCompletion(battle, trainer.id);

    expect(state.winner).toBe("player");
    expect(rewards).not.toBeNull();
    expect(rewards?.gold).toBeGreaterThan(0);
    expect(rewards?.monsters).toHaveLength(3);
    expect(rewards?.monsters.every((m) => m.expGained > 0)).toBe(true);

    const trainerAfter = await repository.getDemoTrainer();
    expect(trainerAfter?.gold).toBe(goldBefore + (rewards?.gold ?? 0));

    const monsters = await repository.listMonsters();
    const team = monsters.filter((m) => m.id !== outsider.id);
    const outsiderAfter = monsters.find((m) => m.id === outsider.id);
    for (const m of team) {
      expect(m.exp).toBeGreaterThan(0);
    }
    expect(outsiderAfter?.exp).toBe(0); // untouched
  });

  it("defeat grants less EXP and gold than victory", async () => {
    // Defeat first with a weak team
    const weak = await buildWeakTeam();
    const goldBeforeDefeat = (await repository.getDemoTrainer())?.gold ?? 0;
    const defeatResult = await fightToCompletion(weak.battle, weak.trainer.id);
    expect(defeatResult.state.winner).toBe("opponent");
    const defeatExp = defeatResult.rewards?.monsters[0]?.expGained ?? 0;
    const defeatGold = defeatResult.rewards?.gold ?? 0;
    const goldAfterDefeat = (await repository.getDemoTrainer())?.gold ?? 0;
    expect(goldAfterDefeat - goldBeforeDefeat).toBeGreaterThan(0);

    // Victory with a strong team (fresh trainer state via reset is per-test;
    // reuse the same trainer for the comparison)
    const strong = await buildTeam();
    const victoryResult = await fightToCompletion(strong.battle, strong.trainer.id);
    expect(victoryResult.state.winner).toBe("player");
    const victoryExp = victoryResult.rewards?.monsters[0]?.expGained ?? 0;
    const victoryGold = victoryResult.rewards?.gold ?? 0;

    expect(victoryExp).toBeGreaterThan(defeatExp);
    expect(victoryGold).toBeGreaterThan(defeatGold);
  });

  it("settles rewards exactly once — duplicate submissions change nothing", async () => {
    const { trainer, battle } = await buildTeam();
    const { state, rewards } = await fightToCompletion(battle, trainer.id);
    expect(state.status).toBe("completed");
    expect(rewards).not.toBeNull();

    const goldAfter = (await repository.getDemoTrainer())?.gold ?? 0;
    const monstersAfter = await repository.listMonsters();
    const snapshot = monstersAfter.map((m) => ({
      level: m.level,
      exp: m.exp,
      hp: m.hp,
      battleCount: m.battleCount,
      wins: m.wins,
    }));

    // Duplicate submit (stale turn / completed battle) must be rejected
    await expect(
      submitBattleAction(repository, {
        trainerId: trainer.id,
        battleId: battle.id,
        expectedTurn: state.turn,
        action: { type: "basic_attack" },
      }),
    ).rejects.toThrow(/already over/);
    await expect(
      submitBattleAction(repository, {
        trainerId: trainer.id,
        battleId: battle.id,
        expectedTurn: 1,
        action: { type: "basic_attack" },
      }),
    ).rejects.toThrow();

    expect((await repository.getDemoTrainer())?.gold).toBe(goldAfter);
    const monstersNow = await repository.listMonsters();
    expect(
      monstersNow.map((m) => ({
        level: m.level,
        exp: m.exp,
        hp: m.hp,
        battleCount: m.battleCount,
        wins: m.wins,
      })),
    ).toEqual(snapshot);

    // Statistics still incremented exactly once
    expect((await repository.getDemoTrainer())?.battleCount).toBe(1);
    for (const monster of monstersNow) {
      expect(monster.battleCount).toBe(1);
    }
  });

  it("persists the reward snapshot on the battle record", async () => {
    const { trainer, battle } = await buildTeam();
    await fightToCompletion(battle, trainer.id);
    const record = await repository.getBattleById(battle.id);
    expect(record?.rewards).not.toBeNull();
    expect(record?.rewards?.gold).toBeGreaterThan(0);
    expect(record?.rewards?.monsters).toHaveLength(3);
    expect(Array.isArray(record?.rewards?.items)).toBe(true);
  });
});

describe("level up, stats & skill unlock", () => {
  it("levels up a monster, recalculates stats and unlocks skills", async () => {
    const sparkmouse = getSpeciesBySlug("sparkmouse")!; // thunder-fang @ Lv10
    const { trainer } = await createTrainerWithStarter(
      repository,
      "Ash",
      "firecub",
    );
    const spark = generateMonster(sparkmouse, { owner: trainer.id });
    spark.level = 9;
    spark.exp = 8099; // Lv9 needs 8100 → one battle pushes to Lv10
    const third = generateMonster(getSpeciesBySlug("magmaboar")!, {
      owner: trainer.id,
    });
    await repository.addMonster(spark);
    await repository.addMonster(third);

    const monsters = await repository.listMonsters();
    for (const m of monsters) {
      m.attack = 999;
      m.defense = 999;
    }
    const dna = spark.dna;

    const ids = monsters.slice(0, 3).map((m) => m.id);
    await saveBattleTeam(repository, trainer.id, ids);
    const battle = await createBattle(repository, trainer.id);

    const { state, rewards } = await fightToCompletion(battle, trainer.id);
    expect(state.winner).toBe("player");

    const leveled = await repository.getMonster(spark.id);
    expect(leveled?.level).toBeGreaterThan(9);
    expect(leveled?.exp).toBeGreaterThanOrEqual(0);

    // Stats are the canonical recalculation, not an increment
    const expected = calculateMonsterStats(sparkmouse, dna, leveled!.level);
    expect(leveled?.hp).toBe(expected.hp);
    expect(leveled?.attack).toBe(expected.attack);
    expect(leveled?.defense).toBe(expected.defense);
    expect(leveled?.speed).toBe(expected.speed);

    // thunder-fang (unlockLevel 10) unlocked
    const unlockedEntry = rewards?.monsters.find(
      (m) => m.monsterId === spark.id,
    );
    expect(unlockedEntry?.unlockedSkills).toContain("thunder-fang");
    expect(leveled?.skills.map((s) => s.id)).toContain("thunder-fang");
  });

  it("never exceeds the 4-skill limit when leveling up", async () => {
    const firecub = getSpeciesBySlug("firecub")!; // flame-burst @ Lv8
    const { trainer, battle, monsters } = await buildTeam((mons) => {
      const target = mons.find((m) => m.speciesId === firecub.id);
      if (target) {
        target.level = 7;
        target.exp = 4899; // Lv7 needs 4900 → one battle reaches Lv8
        // Already 4 skills — no room for flame-burst
        target.skills = [
          { id: "ember", name: "Ember", element: "fire", power: 35, accuracy: 100, description: "" },
          { id: "fire-fang", name: "Fire Fang", element: "fire", power: 60, accuracy: 95, description: "" },
          { id: "leaf-slap", name: "Leaf Slap", element: "nature", power: 40, accuracy: 100, description: "" },
          { id: "spark", name: "Spark", element: "electric", power: 40, accuracy: 100, description: "" },
        ];
      }
    });

    const target = monsters.find((m) => m.speciesId === firecub.id);
    if (!target) throw new Error("fixture: firecub missing");

    const { state, rewards } = await fightToCompletion(battle, trainer.id);
    expect(state.winner).toBe("player");

    const leveled = await repository.getMonster(target.id);
    expect(leveled?.level).toBeGreaterThanOrEqual(8);
    expect(leveled?.skills.length).toBe(4); // no 5th skill
    const entry = rewards?.monsters.find((m) => m.monsterId === target.id);
    expect(entry?.unlockedSkills).not.toContain("flame-burst");
  });
});

describe("item rewards", () => {
  it("drops an Ultra Capsule on victory with a fixed RandomSource (≥0.98)", async () => {
    // All rolls 0.995 → best skill, ultra capsule drop (no stone at that roll)
    setRandomSource({ next: () => 0.995 });
    const { trainer, battle } = await buildTeam();
    const { state } = await fightToCompletion(battle, trainer.id);
    expect(state.winner).toBe("player");

    const inventory = await repository.getInventory(trainer.id);
    const ultra = inventory.find((i) => i.slug === "ultra-ball");
    expect(ultra?.quantity ?? 0).toBe(3); // 2 starter + 1 drop
  });

  it("grants the same reward for the same input with a fixed RandomSource", async () => {
    setRandomSource({ next: () => 0.99 });
    const { trainer, battle } = await buildTeam();
    const { rewards } = await fightToCompletion(battle, trainer.id);
    expect(rewards?.items).toEqual([{ itemSlug: "ultra-ball", quantity: 1 }]);
  });

  it("drops a Fire Stone via the preserved evolution-item roll (<0.01)", async () => {
    // roll 0.005 → ball roll misses (<0.58) but stone roll hits (<0.01)
    setRandomSource({ next: () => 0.005 });
    const { trainer, battle } = await buildTeam();
    const { state } = await fightToCompletion(battle, trainer.id);
    expect(state.winner).toBe("player");

    const inventory = await repository.getInventory(trainer.id);
    const stone = inventory.find((i) => i.slug === "fire-stone");
    expect(stone?.quantity ?? 0).toBe(1);
  });
});
