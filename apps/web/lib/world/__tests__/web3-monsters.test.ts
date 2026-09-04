import { getSpeciesById, getSkillById, MONSTER_SPECIES, SKILLS } from "@chainmon/monster-data";
import { existsSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  getEvolutionVisualLine,
  getMonsterVisualPath,
  getVisualBySpeciesId,
  MONSTER_VISUAL_DIMENSIONS,
  MONSTER_VISUALS,
} from "../monster-visuals";

describe("Web3 monster data (21-28)", () => {
  const web3 = MONSTER_SPECIES.filter((s) => s.id >= 21);

  it("adds exactly 8 Web3 species with ids 21-28", () => {
    expect(web3).toHaveLength(8);
    expect(web3.map((s) => s.id)).toEqual([21, 22, 23, 24, 25, 26, 27, 28]);
  });

  it("matches the required species identity (name/element/rarity)", () => {
    const expected: Record<number, { name: string; element: string; rarity: string }> = {
      21: { name: "Swapicorn", element: "electric", rarity: "rare" },
      22: { name: "OracleOwl", element: "nature", rarity: "rare" },
      23: { name: "ZkBat", element: "electric", rarity: "epic" },
      24: { name: "BridgeFox", element: "fire", rarity: "rare" },
      25: { name: "Lendgeist", element: "water", rarity: "epic" },
      26: { name: "GasGoblin", element: "fire", rarity: "common" },
      27: { name: "MevMantis", element: "nature", rarity: "epic" },
      28: { name: "VaultTurtle", element: "water", rarity: "legendary" },
    };
    for (const s of web3) {
      const e = expected[s.id]!;
      expect(s.name).toBe(e.name);
      expect(s.element).toBe(e.element);
      expect(s.rarity).toBe(e.rarity);
    }
  });

  it("has unique ids / slugs / names across all 28", () => {
    expect(new Set(MONSTER_SPECIES.map((s) => s.id)).size).toBe(28);
    expect(new Set(MONSTER_SPECIES.map((s) => s.slug)).size).toBe(28);
    expect(new Set(MONSTER_SPECIES.map((s) => s.name)).size).toBe(28);
  });

  it("every Web3 species has a valid catchRate > 0 and 4 skills", () => {
    for (const s of web3) {
      expect(s.catchRate).toBeGreaterThan(0);
      expect(s.catchRate).toBeLessThanOrEqual(0.5);
      expect(s.learnableSkills).toHaveLength(4);
      for (const entry of s.learnableSkills) {
        const skill = getSkillById(entry.skillId);
        expect(skill, `${s.name} skill ${entry.skillId}`).toBeDefined();
        expect(skill!.element).toBe(s.element);
        expect(skill!.knowledgeTitle).toBeTruthy();
        expect(skill!.knowledgeSummary).toBeTruthy();
      }
    }
  });

  it("covers the 8 required knowledge concepts", () => {
    const web3Skills = SKILLS.filter((s) => s.knowledgeTitle);
    const summaries = web3Skills.map((s) => s.knowledgeSummary ?? "");
    expect(summaries.some((t) => t.includes("decentralized exchange"))).toBe(true); // swap/AMM
    expect(summaries.some((t) => t.includes("oracle"))).toBe(true);
    expect(summaries.some((t) => t.includes("Zero-knowledge") || t.includes("zero-knowledge"))).toBe(true);
    expect(summaries.some((t) => t.includes("bridge"))).toBe(true);
    expect(summaries.some((t) => t.includes("lending") || t.includes("collateral"))).toBe(true);
    expect(summaries.some((t) => t.includes("Gas represents"))).toBe(true);
    expect(summaries.some((t) => t.includes("MEV"))).toBe(true);
    expect(summaries.some((t) => t.includes("Self-custody"))).toBe(true);
    expect(web3Skills.length).toBe(32); // 8 × 4
  });

  it("uses original designs — no real brand logos in text", () => {
    const allText = [...MONSTER_SPECIES.map((s) => s.description), ...SKILLS.map((s) => s.description ?? "")].join(" ");
    for (const banned of ["Uniswap", "Chainlink", "MetaMask", "Ledger"]) {
      expect(allText).not.toContain(banned);
    }
  });
});

describe("monster visual manifest", () => {
  it("preserves the canonical 28-species rarity distribution", () => {
    const count = (rarity: string) => MONSTER_SPECIES.filter((species) => species.rarity === rarity).length;
    expect(MONSTER_SPECIES).toHaveLength(28);
    expect(getSpeciesById(1)?.name).toBe("FireCub");
    expect(count("common")).toBe(9);
    expect(count("rare")).toBe(9);
    expect(count("epic")).toBe(7);
    expect(count("legendary")).toBe(3);
  });

  it("covers species 1-28 with all three asset kinds", () => {
    expect(MONSTER_VISUALS).toHaveLength(28);
    for (const entry of MONSTER_VISUALS) {
      expect(entry.overworld.endsWith("overworld.png")).toBe(true);
      expect(entry.battleFront.endsWith("battle-front.png")).toBe(true);
      expect(entry.portrait.endsWith("portrait.png")).toBe(true);
    }
  });

  it("resolves paths per speciesId (no hardcoded paths in components)", () => {
    expect(getMonsterVisualPath(21, "portrait")).toContain("021-swapicorn");
    expect(getMonsterVisualPath(28, "overworld")).toContain("028-vaultturtle");
    expect(() => getVisualBySpeciesId(999)).toThrow();
  });

  it("ships every manifest path as a real PNG (28 × 3 = 84)", () => {
    const paths = MONSTER_VISUALS.flatMap((entry) => [entry.overworld, entry.battleFront, entry.portrait]);
    expect(paths).toHaveLength(84);
    for (const assetPath of paths) {
      expect(existsSync(join(process.cwd(), "apps/web/public", assetPath))).toBe(true);
    }
  });

  it("records native dimensions, pixel rendering and only real evolution links", () => {
    expect(MONSTER_VISUAL_DIMENSIONS).toEqual({
      overworld: 32,
      "battle-front": 64,
      portrait: 128,
    });
    for (let id = 1; id <= 28; id++) {
      const visual = getVisualBySpeciesId(id);
      expect(visual.displayName).toBe(getSpeciesById(id)?.name);
      expect(visual.pixelRenderingMode).toBe("pixelated");
      expect(visual.evolutionStage).toBeGreaterThanOrEqual(1);
    }
    expect(getEvolutionVisualLine(2).map((entry) => entry.speciesId)).toEqual([1, 2, 3]);
    expect(getEvolutionVisualLine(21).map((entry) => entry.speciesId)).toEqual([21]);
  });
});
