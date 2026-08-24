import type { Skill } from "@chainmon/shared";
import { afterEach, describe, expect, it } from "vitest";
import {
  type BattleAction,
  type BattleCreatureState,
  type BattleState,
  resolveRound,
  validateAction,
} from "../battle";
import { resetRandomSource, setRandomSource, type RandomSource } from "../random";

const source = (value: number): RandomSource => ({ next: () => value });

const EMBER: Skill = {
  id: "ember",
  name: "Ember",
  element: "fire",
  power: 35,
  accuracy: 100,
  description: "",
};

const WATER_GUN: Skill = {
  id: "water-gun",
  name: "Water Gun",
  element: "water",
  power: 40,
  accuracy: 100,
  description: "",
};

function creature(overrides: Partial<BattleCreatureState> = {}): BattleCreatureState {
  return {
    battleMonsterId: "bm-1",
    speciesId: 1,
    speciesName: "Mon",
    element: "fire",
    rarity: "common",
    level: 1,
    maxHp: 100,
    currentHp: 100,
    attack: 50,
    defense: 50,
    speed: 50,
    skills: [EMBER],
    fainted: false,
    ...overrides,
  };
}

function buildState(overrides: Partial<BattleState> = {}): BattleState {
  return {
    id: "battle-1",
    trainerId: "trainer-1",
    status: "active",
    turn: 1,
    playerTeam: [
      creature({
        battleMonsterId: "p1",
        speciesName: "FireCub",
        attack: 70,
        defense: 40,
        speed: 90,
        maxHp: 80,
        currentHp: 80,
      }),
    ],
    opponentTeam: [
      creature({
        battleMonsterId: "a1",
        speciesName: "AquaTurtle",
        element: "water",
        attack: 45,
        defense: 60,
        speed: 50,
        maxHp: 90,
        currentHp: 90,
        skills: [WATER_GUN],
      }),
    ],
    playerActiveIndex: 0,
    opponentActiveIndex: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

afterEach(() => {
  resetRandomSource();
});

describe("resolveRound — basic resolution", () => {
  it("applies skill damage, logs entries and increments the turn", () => {
    const state = buildState();
    // Fire vs Water → 0.75; ember power 35; player atk 70; AI def 60
    // base = 35*70/60*0.5 = 20.416; ×0.75 = 15.31; rf 1.0 → floor 15
    const result = resolveRound(
      state,
      { type: "skill", skillId: "ember" },
      { type: "basic_attack" },
      source(0.5),
    );
    expect(result.state.opponentTeam[0]?.currentHp).toBe(75);
    expect(result.state.turn).toBe(2);
    expect(result.state.status).toBe("active");
    expect(result.logs.some((l) => l.type === "skill")).toBe(true);
    expect(result.logs.some((l) => l.type === "damage" && l.damage === 15)).toBe(true);
  });

  it("resisted element attack is logged as not very effective", () => {
    const result = resolveRound(
      buildState(),
      { type: "skill", skillId: "ember" },
      { type: "basic_attack" },
      source(0.5),
    );
    expect(
      result.logs.some(
        (l) => l.elementMultiplier === 0.75 && l.message.includes("not very effective"),
      ),
    ).toBe(true);
  });

  it("deals 0 damage on a miss and keeps the turn flowing", () => {
    const state = buildState();
    // give the AI a 90%-accuracy skill: ember acc 100 — use thunder fang style skill
    state.opponentTeam[0]!.skills = [
      { ...WATER_GUN, id: "bubble-beam", accuracy: 90 },
    ];
    const result = resolveRound(
      state,
      { type: "defend" },
      { type: "skill", skillId: "bubble-beam" },
      source(0.95), // accuracy roll 0.95 → miss (90%)
    );
    expect(result.logs.some((l) => l.type === "miss")).toBe(true);
    expect(result.state.playerTeam[0]?.currentHp).toBe(80);
  });
});

describe("resolveRound — priority & speed", () => {
  it("lets the faster monster act first (Speed 90 vs 50)", () => {
    const state = buildState();
    // Both basic attack; player kills AI in one hit → AI never attacks.
    state.playerTeam[0]!.attack = 999;
    const result = resolveRound(
      state,
      { type: "basic_attack" },
      { type: "basic_attack" },
      source(0.5),
    );
    const firstAttack = result.logs.find((l) => l.type === "attack");
    expect(firstAttack?.actor).toBe("FireCub");
    expect(result.state.opponentTeam[0]?.currentHp).toBe(0);
    expect(result.state.playerTeam[0]?.currentHp).toBe(80); // AI action skipped
  });

  it("breaks speed ties with the RandomSource (0.1 → player first)", () => {
    const state = buildState();
    state.playerTeam[0]!.speed = 50;
    const result = resolveRound(
      state,
      { type: "basic_attack" },
      { type: "basic_attack" },
      source(0.1),
    );
    const firstAttack = result.logs.find((l) => l.type === "attack");
    expect(firstAttack?.actor).toBe("FireCub");
  });

  it("breaks speed ties with the RandomSource (0.9 → AI first)", () => {
    const state = buildState();
    state.playerTeam[0]!.speed = 50;
    const result = resolveRound(
      state,
      { type: "basic_attack" },
      { type: "basic_attack" },
      source(0.9),
    );
    const firstAttack = result.logs.find((l) => l.type === "attack");
    expect(firstAttack?.actor).toBe("AquaTurtle");
  });

  it("resolves Defend before attacks (priority 1 > 0)", () => {
    const state = buildState();
    // AI basic attack: base = 40*45/40*0.5 = 22.5 → defend → floor(11.25) = 11
    const result = resolveRound(
      state,
      { type: "defend" },
      { type: "basic_attack" },
      source(0.5),
    );
    expect(result.state.playerTeam[0]?.currentHp).toBe(69); // 80 - 11
    expect(result.state.playerTeam[0]?.defending).toBe(false); // cleared
  });

  it("clears Defend at the end of the round", () => {
    const state = buildState();
    const first = resolveRound(state, { type: "defend" }, { type: "defend" }, source(0.5));
    expect(first.state.playerTeam[0]?.defending).toBe(false);
    expect(first.state.opponentTeam[0]?.defending).toBe(false);
  });
});

describe("resolveRound — faint & auto-switch", () => {
  it("clamps currentHp at 0, marks fainted and auto-switches", () => {
    const state = buildState();
    state.opponentTeam = [
      creature({ battleMonsterId: "a1", speciesName: "AquaTurtle", currentHp: 5, maxHp: 90 }),
      creature({ battleMonsterId: "a2", speciesName: "BubbleFin", currentHp: 60, maxHp: 60 }),
      creature({ battleMonsterId: "a3", speciesName: "TideOtter", currentHp: 50, maxHp: 65 }),
    ];
    const result = resolveRound(
      state,
      { type: "basic_attack" },
      { type: "basic_attack" },
      source(0.5),
    );
    expect(result.state.opponentTeam[0]?.currentHp).toBe(0);
    expect(result.state.opponentTeam[0]?.fainted).toBe(true);
    expect(result.state.opponentActiveIndex).toBe(1);
    expect(
      result.logs.some((l) => l.type === "switch" && l.message.includes("entered battle")),
    ).toBe(true);
  });

  it("ends the battle in victory when all AI monsters faint", () => {
    let state = buildState();
    state.playerTeam[0]!.attack = 999;
    state.opponentTeam = [
      creature({ battleMonsterId: "a1", speciesName: "A1", currentHp: 1, maxHp: 50 }),
      creature({ battleMonsterId: "a2", speciesName: "A2", currentHp: 1, maxHp: 50 }),
      creature({ battleMonsterId: "a3", speciesName: "A3", currentHp: 1, maxHp: 50 }),
    ];
    let lastLogs: ReturnType<typeof resolveRound>["logs"] = [];
    for (let i = 0; i < 3; i++) {
      const result = resolveRound(state, { type: "basic_attack" }, { type: "basic_attack" }, source(0.5));
      state = result.state;
      lastLogs = result.logs;
    }
    expect(state.status).toBe("completed");
    expect(state.winner).toBe("player");
    expect(lastLogs.some((l) => l.type === "battle_end")).toBe(true);
  });

  it("ends the battle in defeat when all player monsters faint", () => {
    let state = buildState();
    state.opponentTeam[0]!.attack = 999;
    state.playerTeam = [
      creature({ battleMonsterId: "p1", speciesName: "P1", currentHp: 1, maxHp: 50 }),
      creature({ battleMonsterId: "p2", speciesName: "P2", currentHp: 1, maxHp: 50 }),
      creature({ battleMonsterId: "p3", speciesName: "P3", currentHp: 1, maxHp: 50 }),
    ];
    let lastLogs: ReturnType<typeof resolveRound>["logs"] = [];
    for (let i = 0; i < 3; i++) {
      const result = resolveRound(state, { type: "basic_attack" }, { type: "basic_attack" }, source(0.5));
      state = result.state;
      lastLogs = result.logs;
    }
    expect(state.status).toBe("completed");
    expect(state.winner).toBe("opponent");
    expect(lastLogs.some((l) => l.type === "battle_end")).toBe(true);
  });

  it("rejects actions on a completed battle", () => {
    const state = buildState({ status: "completed", winner: "player" });
    expect(() =>
      resolveRound(state, { type: "basic_attack" }, { type: "basic_attack" }, source(0.5)),
    ).toThrow(/already over/);
  });
});

describe("validateAction", () => {
  it("rejects switching to a fainted monster", () => {
    const state = buildState();
    state.playerTeam.push(
      creature({ battleMonsterId: "p2", speciesName: "P2", fainted: true, currentHp: 0 }),
    );
    expect(() =>
      validateAction(state, "player", { type: "switch", targetBattleMonsterId: "p2" }),
    ).toThrow(/fainted/);
  });

  it("rejects switching to the active monster", () => {
    const state = buildState();
    expect(() =>
      validateAction(state, "player", { type: "switch", targetBattleMonsterId: "p1" }),
    ).toThrow(/active monster/);
  });

  it("rejects switching to a monster outside the team", () => {
    const state = buildState();
    expect(() =>
      validateAction(state, "player", { type: "switch", targetBattleMonsterId: "a1" }),
    ).toThrow(/not in this team/);
  });

  it("rejects switching to a missing monster", () => {
    const state = buildState();
    expect(() =>
      validateAction(state, "player", { type: "switch", targetBattleMonsterId: "nope" }),
    ).toThrow(/not in this team/);
  });

  it("rejects skills the monster does not know", () => {
    const state = buildState();
    expect(() =>
      validateAction(state, "player", { type: "skill", skillId: "thunderbolt" }),
    ).toThrow(/does not know skill/);
  });

  it("rejects actions when the active monster is fainted", () => {
    const state = buildState();
    state.playerTeam[0]!.fainted = true;
    expect(() => validateAction(state, "player", { type: "basic_attack" })).toThrow(/fainted/);
  });
});

describe("resolveRound — switch action", () => {
  it("switches the active monster and logs it", () => {
    const state = buildState();
    state.playerTeam.push(
      creature({ battleMonsterId: "p2", speciesName: "P2", maxHp: 70, currentHp: 70 }),
    );
    const result = resolveRound(
      state,
      { type: "switch", targetBattleMonsterId: "p2" },
      { type: "defend" },
      source(0.5),
    );
    expect(result.state.playerActiveIndex).toBe(1);
    expect(result.logs.some((l) => l.type === "switch" && l.actor === "FireCub")).toBe(true);
  });
});
