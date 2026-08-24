import { describe, expect, it } from "vitest";
import { getRegionById, REGIONS } from "../regions";
import { MONSTER_SPECIES } from "../species";

describe("regions", () => {
  it("defines exactly 4 regions", () => {
    expect(REGIONS).toHaveLength(4);
  });

  it("includes Forest, Lake, Volcano and Power Plant", () => {
    for (const id of ["forest", "lake", "volcano", "power-plant"]) {
      expect(getRegionById(id), `missing region ${id}`).toBeDefined();
    }
  });

  it("has unique region ids", () => {
    expect(new Set(REGIONS.map((r) => r.id)).size).toBe(REGIONS.length);
  });

  it("gives every region a non-empty encounter table", () => {
    for (const region of REGIONS) {
      expect(region.encounters.length, region.id).toBeGreaterThan(0);
    }
  });

  it("uses only positive weights", () => {
    for (const region of REGIONS) {
      for (const entry of region.encounters) {
        expect(entry.weight, `${region.id}:${entry.speciesId}`).toBeGreaterThan(0);
      }
    }
  });

  it("references only known species", () => {
    const knownIds = new Set(MONSTER_SPECIES.map((s) => s.id));
    for (const region of REGIONS) {
      for (const entry of region.encounters) {
        expect(
          knownIds.has(entry.speciesId),
          `${region.id} references unknown species ${entry.speciesId}`,
        ).toBe(true);
      }
    }
  });

  it("keeps legendary monsters extremely rare", () => {
    for (const region of REGIONS) {
      const total = region.encounters.reduce((sum, e) => sum + e.weight, 0);
      for (const entry of region.encounters) {
        const species = MONSTER_SPECIES.find((s) => s.id === entry.speciesId);
        if (species?.rarity === "legendary") {
          expect(
            entry.weight / total,
            `${region.id} legendary weight share`,
          ).toBeLessThanOrEqual(0.02);
        }
      }
    }
  });

  it("keeps epic monsters clearly rarer than commons in every region", () => {
    for (const region of REGIONS) {
      const byRarity: Record<string, number> = {};
      for (const entry of region.encounters) {
        const species = MONSTER_SPECIES.find((s) => s.id === entry.speciesId);
        if (!species) continue;
        byRarity[species.rarity] = (byRarity[species.rarity] ?? 0) + entry.weight;
      }
      const common = byRarity.common ?? 0;
      const epic = byRarity.epic ?? 0;
      if (epic > 0) {
        expect(epic, `${region.id} epic weight`).toBeLessThan(common);
      }
    }
  });

  it("matches every region's main element to its dominant species", () => {
    for (const region of REGIONS) {
      const dominant = MONSTER_SPECIES.find((s) => s.id === region.encounters[0]?.speciesId);
      expect(dominant?.element).toBe(region.mainElement);
    }
  });
});
