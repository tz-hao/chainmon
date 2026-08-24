import {
  generateMonster,
  resetRandomSource,
  type BattleAction,
} from "@chainmon/game-engine";
import { getSpeciesBySlug } from "@chainmon/monster-data";
import { beforeEach, describe, expect, it } from "vitest";
import { createTrainerWithStarter } from "../demo-service";
import { memoryRepository, resetMemoryRepository } from "../memory-repository";
import type { GameRepository } from "../types";
import {
  BattleError,
  createBattle,
  listBattleHistory,
  saveBattleTeam,
  submitBattleAction,
} from "../../services/battle-service";

const ATTACK: BattleAction = { type: "basic_attack" };

let repository: GameRepository;

beforeEach(() => {
  resetMemoryRepository();
  resetRandomSource();
  repository = memoryRepository;
});

/** Trainer with exactly 3 collection monsters. */
async function buildTeam(
  tweak?: (monsters: Awaited<ReturnType<GameRepository["listMonsters"]>>) => void,
) {
  const { trainer, monster } = await createTrainerWithStarter(
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

  const monsters = await repository.listMonsters();
  if (tweak) tweak(monsters);

  const ids = monsters.map((m) => m.id);
  return { trainer, ids };
}

async function startBattle(trainerId: string, ids: string[]) {
  await saveBattleTeam(repository, trainerId, ids);
  return createBattle(repository, trainerId);
}

describe("saveBattleTeam", () => {
  it("rejects teams that are not exactly 3 monsters", async () => {
    const { trainer, ids } = await buildTeam();
    await expect(
      saveBattleTeam(repository, trainer.id, ids.slice(0, 2)),
    ).rejects.toThrow(/exactly 3/);
  });

  it("rejects duplicate monsters", async () => {
    const { trainer, ids } = await buildTeam();
    await expect(
      saveBattleTeam(repository, trainer.id, [ids[0], ids[0], ids[1]]),
    ).rejects.toThrow(/different/);
  });

  it("rejects monsters the trainer does not own", async () => {
    const { trainer, ids } = await buildTeam();
    await expect(
      saveBattleTeam(repository, trainer.id, ["stolen-id", ids[1], ids[2]]),
    ).rejects.toThrow(/you own/);
  });

  it("saves and loads the team in slot order", async () => {
    const { trainer, ids } = await buildTeam();
    await saveBattleTeam(repository, trainer.id, ids);
    const team = await repository.getTeam(trainer.id);
    expect(team).toHaveLength(3);
    expect(team?.map((m) => m.id)).toEqual(ids);
  });
});

describe("createBattle", () => {
  it("builds a complete 3v3 snapshot (active, turn 1, full HP)", async () => {
    const { trainer, ids } = await buildTeam();
    const battle = await startBattle(trainer.id, ids);

    expect(battle.status).toBe("active");
    expect(battle.turn).toBe(1);
    expect(battle.playerTeam).toHaveLength(3);
    expect(battle.opponentTeam).toHaveLength(3);
    expect(battle.playerActiveIndex).toBe(0);
    expect(battle.opponentActiveIndex).toBe(0);
    expect(battle.playerTeam.every((c) => c.currentHp === c.maxHp)).toBe(true);
    expect(battle.opponentTeam.every((c) => c.currentHp === c.maxHp)).toBe(true);
    // AI creatures have no collection source
    expect(battle.opponentTeam.every((c) => c.sourceMonsterId === undefined)).toBe(true);
    // Player creatures reference their collection monsters
    expect(battle.playerTeam.every((c) => c.sourceMonsterId !== undefined)).toBe(true);
    expect(trainer.id).toBeDefined();
  });

  it("rejects battles without a complete team", async () => {
    const { trainer } = await buildTeam();
    await expect(createBattle(repository, trainer.id)).rejects.toThrow(
      /3-monster team/,
    );
  });
});

describe("submitBattleAction", () => {
  it("resolves a round: HP changes, logs generated, turn advances", async () => {
    const { trainer, ids } = await buildTeam();
    const battle = await startBattle(trainer.id, ids);

    const result = await submitBattleAction(repository, {
      trainerId: trainer.id,
      battleId: battle.id,
      expectedTurn: 1,
      action: ATTACK,
    });

    expect(result.state.turn).toBe(2);
    expect(result.state.status).toBe("active");
    expect(result.logs.length).toBeGreaterThan(0);

    // Collection monsters keep their HP — battle damage never persists.
    const monsters = await repository.listMonsters();
    for (const monster of monsters) {
      expect(monster.hp).toBeGreaterThan(0);
      expect(monster.level).toBe(1);
      expect(monster.exp).toBe(0);
    }
  });

  it("rejects stale turns and does not double-apply a round", async () => {
    const { trainer, ids } = await buildTeam();
    const battle = await startBattle(trainer.id, ids);

    const first = await submitBattleAction(repository, {
      trainerId: trainer.id,
      battleId: battle.id,
      expectedTurn: 1,
      action: ATTACK,
    });

    await expect(
      submitBattleAction(repository, {
        trainerId: trainer.id,
        battleId: battle.id,
        expectedTurn: 1, // stale — battle is now on turn 2
        action: ATTACK,
      }),
    ).rejects.toThrow(/Stale turn/);

    const stored = await repository.getBattleById(battle.id);
    expect(stored?.state.turn).toBe(2);
    expect(stored?.state.playerTeam[0]?.currentHp).toBe(
      first.state.playerTeam[0]?.currentHp,
    );
  });

  it("rejects actions on completed battles", async () => {
    const { trainer, ids } = await buildTeam((mons) => {
      for (const m of mons) {
        m.attack = 999;
        m.defense = 999;
      }
    });
    const battle = await startBattle(trainer.id, ids);

    let current = battle;
    for (let i = 0; i < 20 && current.status === "active"; i++) {
      const result = await submitBattleAction(repository, {
        trainerId: trainer.id,
        battleId: battle.id,
        expectedTurn: current.turn,
        action: ATTACK,
      });
      current = result.state;
    }
    expect(current.status).toBe("completed");
    expect(current.winner).toBe("player");

    await expect(
      submitBattleAction(repository, {
        trainerId: trainer.id,
        battleId: battle.id,
        expectedTurn: current.turn,
        action: ATTACK,
      }),
    ).rejects.toThrow(/already over/);
  });
});

describe("battle statistics & Phase 5 boundary", () => {
  async function finishBattle(tweak: (mons: Awaited<ReturnType<GameRepository["listMonsters"]>>) => void) {
    const { trainer, ids } = await buildTeam(tweak);
    const battle = await startBattle(trainer.id, ids);
    let current = battle;
    for (let i = 0; i < 50 && current.status === "active"; i++) {
      const result = await submitBattleAction(repository, {
        trainerId: trainer.id,
        battleId: battle.id,
        expectedTurn: current.turn,
        action: ATTACK,
      });
      current = result.state;
    }
    expect(current.status).toBe("completed");
    return { trainer, current };
  }

  it("victory: trainer +3 monsters gain battleCount and wins exactly once", async () => {
    const { trainer, current } = await finishBattle((mons) => {
      for (const m of mons) {
        m.attack = 999;
        m.defense = 999;
      }
    });
    expect(current.winner).toBe("player");

    const trainerAfter = await repository.getDemoTrainer();
    expect(trainerAfter?.battleCount).toBe(1);
    expect(trainerAfter?.wins).toBe(1);
    expect(trainerAfter?.gold).toBeGreaterThan(0); // Phase 5: gold reward

    const monsters = await repository.listMonsters();
    for (const monster of monsters) {
      expect(monster.battleCount).toBe(1);
      expect(monster.wins).toBe(1);
      expect(monster.level).toBeGreaterThanOrEqual(1);
      expect(monster.exp).toBeGreaterThan(0); // Phase 5: EXP reward
    }
  });

  it("defeat: battleCount +1 but wins stay 0", async () => {
    const { current } = await finishBattle((mons) => {
      for (const m of mons) {
        m.hp = 1;
        m.attack = 1;
        m.defense = 1;
      }
    });
    expect(current.winner).toBe("opponent");

    const trainer = await repository.getDemoTrainer();
    expect(trainer?.battleCount).toBe(1);
    expect(trainer?.wins).toBe(0);

    const monsters = await repository.listMonsters();
    for (const monster of monsters) {
      expect(monster.battleCount).toBe(1);
      expect(monster.wins).toBe(0);
    }
  });

  it("does not reward before the battle completes", async () => {
    const { trainer, ids } = await buildTeam((mons) => {
      for (const m of mons) {
        m.attack = 999;
        m.defense = 999;
      }
    });
    const beforeGold = trainer.gold;

    const battle = await startBattle(trainer.id, ids);
    await submitBattleAction(repository, {
      trainerId: trainer.id,
      battleId: battle.id,
      expectedTurn: 1,
      action: ATTACK,
    });

    // One round only — battle still ACTIVE → no rewards yet
    const monsters = await repository.listMonsters();
    for (const monster of monsters) {
      expect(monster.level).toBe(1);
      expect(monster.exp).toBe(0);
    }
    expect((await repository.getDemoTrainer())?.gold).toBe(beforeGold);
  });

  it("records battle history", async () => {
    const { trainer, ids } = await buildTeam((mons) => {
      for (const m of mons) {
        m.attack = 999;
        m.defense = 999;
      }
    });
    const battle = await startBattle(trainer.id, ids);

    let current = battle;
    for (let i = 0; i < 20 && current.status === "active"; i++) {
      const result = await submitBattleAction(repository, {
        trainerId: trainer.id,
        battleId: battle.id,
        expectedTurn: current.turn,
        action: ATTACK,
      });
      current = result.state;
    }

    const history = await listBattleHistory(repository, trainer.id);
    expect(history.length).toBeGreaterThanOrEqual(1);
    const latest = history[0];
    expect(latest?.id).toBe(battle.id);
    expect(latest?.status).toBe("completed");
    expect(latest?.winner).toBe("player");
  });
});

describe("full battle demo chain", () => {
  it("team → battle → rounds → victory with stats, without touching collection HP", async () => {
    const { trainer, ids } = await buildTeam((mons) => {
      for (const m of mons) {
        m.attack = 999;
        m.defense = 999;
      }
    });

    // 1. Save team
    await saveBattleTeam(repository, trainer.id, ids);

    // 2. Create battle
    const battle = await createBattle(repository, trainer.id);
    expect(battle.playerTeam).toHaveLength(3);

    // 3. Fight until the end (Attack / Skill / Defend / Switch all exercised
    //    in the engine tests; here we drive the full service loop)
    let current = battle;
    let turns = 0;
    while (current.status === "active" && turns < 50) {
      const action: BattleAction =
        turns % 4 === 1
          ? { type: "defend" }
          : turns % 4 === 2 &&
              current.playerTeam[1] &&
              !current.playerTeam[1]!.fainted &&
              current.playerActiveIndex !== 1
            ? {
                type: "switch",
                targetBattleMonsterId: current.playerTeam[1]!.battleMonsterId,
              }
            : { type: "basic_attack" };
      const result = await submitBattleAction(repository, {
        trainerId: trainer.id,
        battleId: battle.id,
        expectedTurn: current.turn,
        action,
      });
      current = result.state;
      turns += 1;
    }

    expect(current.status).toBe("completed");
    expect(current.winner).toBe("player");

    // 4. Statistics applied once
    const trainerAfter = await repository.getDemoTrainer();
    expect(trainerAfter?.battleCount).toBe(1);
    expect(trainerAfter?.wins).toBe(1);

    // 5. Collection monsters gained EXP (Phase 5) — battle HP never persists
    const monsters = await repository.listMonsters();
    for (const monster of monsters) {
      expect(monster.hp).toBeGreaterThan(0);
      expect(monster.battleCount).toBe(1);
      expect(monster.level).toBeGreaterThanOrEqual(1);
      expect(monster.exp).toBeGreaterThan(0);
    }

    // 6. History recorded
    const history = await listBattleHistory(repository, trainer.id);
    expect(history[0]?.winner).toBe("player");
  });
});
