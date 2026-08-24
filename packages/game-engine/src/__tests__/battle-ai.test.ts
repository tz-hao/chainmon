import { MONSTER_SPECIES } from "@chainmon/monster-data";
import { afterEach, describe, expect, it } from "vitest";
import {
  type BattleCreatureState,
  type BattleState,
} from "../battle";
import {
  averageTeamPower,
  aiSpeciesPoolFor,
  chooseAiAction,
  selectAiSpecies,
  selectAiSpeciesIds,
} from "../battle-ai";
import { resetRandomSource, setRandomSource, type RandomSource } from "../random";

const source = (value: number): RandomSource => ({ next: () => value });

function sequence(values: number[]): RandomSource {
  let index = 0;
  return {
    next: () => {
      const value = values[index] ?? values[values.length - 1] ?? 0.5;
      index += 1;
      return value;
    },
  };
}

const EMBER = {
  id: "ember",
  name: "Ember",
  element: "fire",
  power: 35,
  accuracy: 100,
  description: "",
};

const SOLAR_BLADE = {
  id: "solar-blade",
  name: "Solar Blade",
  element: "nature",
  power: 95,
  accuracy: 85,
  description: "",
};

const WATER_GUN = {
  id: "water-gun",
  name: "Water Gun",
  element: "water",
  power: 40,
  accuracy: 100,
  description: "",
};

function aiCreature(overrides: Partial<BattleCreatureState> = {}): BattleCreatureState {
  return {
    battleMonsterId: "ai-1",
    speciesId: 1,
    speciesName: "AI Mon",
    element: "fire",
    rarity: "common",
    level: 1,
    maxHp: 100,
    currentHp: 100,
    attack: 50,
    defense: 50,
    speed: 50,
    skills: [EMBER, SOLAR_BLADE, WATER_GUN],
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
      aiCreature({
        battleMonsterId: "p1",
        speciesName: "Player Mon",
        element: "water",
        speed: 90,
      }),
    ],
    opponentTeam: [
      aiCreature({ battleMonsterId: "a1", speciesName: "AI Mon", speed: 50 }),
      aiCreature({ battleMonsterId: "a2", speciesName: "AI Mon 2", maxHp: 90, currentHp: 90 }),
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

describe("chooseAiAction", () => {
  it("prefers an element-advantage skill (roll < 0.7)", () => {
    // AI fire skills vs player water → fire is resisted (0.75); nature vs water → 1.5 advantage
    const state = buildState();
    const action = chooseAiAction(state, source(0.1));
    expect(action.type).toBe("skill");
    if (action.type === "skill") {
      expect(action.skillId).toBe("solar-blade"); // nature vs water advantage
    }
  });

  it("switches away when low on HP with a healthy backup (roll < 0.4)", () => {
    const state = buildState();
    state.opponentTeam[0]!.currentHp = 10;
    // roll 0.9 → no advantage skill; roll 0.1 → switch (< 0.4)
    const action = chooseAiAction(state, sequence([0.9, 0.1]));
    expect(action.type).toBe("switch");
    if (action.type === "switch") {
      expect(action.targetBattleMonsterId).toBe("a2");
    }
  });

  it("uses best skill by default", () => {
    const state = buildState();
    // player element = nature → fire is advantage! remove advantage skills
    state.playerTeam[0]!.element = "nature";
    const action = chooseAiAction(state, source(0.9));
    expect(action.type).toBe("skill");
    if (action.type === "skill") {
      expect(action.skillId).toBe("solar-blade");
    }
  });

  it("sometimes defends (roll < 0.15)", () => {
    const state = buildState();
    state.playerTeam[0]!.element = "nature";
    // 0.9 → no advantage skill; (full HP skips the switch branch);
    // 0.1 → defend (< 0.15)
    const action = chooseAiAction(state, sequence([0.9, 0.1]));
    expect(action.type).toBe("defend");
  });

  it("is fully deterministic with an injected RandomSource", () => {
    const state = buildState();
    state.playerTeam[0]!.element = "nature";
    const a = chooseAiAction(state, source(0.9));
    const b = chooseAiAction(state, source(0.9));
    expect(a).toEqual(b);
  });
});

describe("averageTeamPower", () => {
  it("averages maxHp + attack + defense + speed over the team", () => {
    const team = [
      aiCreature({ battleMonsterId: "x1", maxHp: 100, attack: 50, defense: 50, speed: 50 }),
      aiCreature({ battleMonsterId: "x2", maxHp: 80, attack: 70, defense: 40, speed: 45 }),
    ];
    // total = (250 + 235) / 2 = 242.5 → 243
    expect(averageTeamPower(team)).toBe(243);
  });
});

describe("AI team generation", () => {
  it("scales the species pool with player power", () => {
    expect(aiSpeciesPoolFor(200)).toEqual(aiSpeciesPoolFor(200));
    const low = aiSpeciesPoolFor(200);
    const mid = aiSpeciesPoolFor(250);
    const high = aiSpeciesPoolFor(290);
    // low tier must not contain legendaries
    for (const id of low) {
      const species = MONSTER_SPECIES.find((s) => s.id === id);
      expect(species?.rarity).not.toBe("legendary");
    }
    expect(mid).not.toEqual(low);
    expect(high).not.toEqual(mid);
  });

  it("picks 3 distinct species from the pool", () => {
    const ids = selectAiSpeciesIds(200, source(0.123));
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    const pool = new Set(aiSpeciesPoolFor(200));
    for (const id of ids) {
      expect(pool.has(id)).toBe(true);
    }
  });

  it("resolves species from the catalogue", () => {
    const { species } = selectAiSpecies(200, MONSTER_SPECIES, source(0.123));
    expect(species).toHaveLength(3);
  });
});
