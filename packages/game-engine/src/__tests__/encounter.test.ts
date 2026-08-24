import { getRegionById } from "@chainmon/monster-data";
import { afterEach, describe, expect, it } from "vitest";
import { generateEncounter } from "../encounter";
import { setRandomSource, resetRandomSource } from "../random";

const forest = getRegionById("forest");
if (!forest) throw new Error("test fixture: forest region missing");

afterEach(() => {
  resetRandomSource();
});

describe("generateEncounter", () => {
  it("builds a complete active encounter with full HP", () => {
    const now = new Date("2025-01-01T00:00:00Z");
    const encounter = generateEncounter(forest, "trainer-1", {
      id: "enc-1",
      now,
    });

    expect(encounter.id).toBe("enc-1");
    expect(encounter.trainerId).toBe("trainer-1");
    expect(encounter.regionId).toBe("forest");
    expect(encounter.status).toBe("active");
    expect(encounter.level).toBe(1);
    expect(encounter.currentHp).toBe(encounter.maxHp);
    expect(encounter.maxHp).toBeGreaterThan(0);
    expect(encounter.createdAt).toEqual(now);
    expect(encounter.updatedAt).toEqual(now);
  });

  it("picks a species that belongs to the region", () => {
    const regionSpeciesIds = new Set(forest.encounters.map((e) => e.speciesId));
    for (let i = 0; i < 50; i++) {
      const encounter = generateEncounter(forest, "trainer-1");
      expect(regionSpeciesIds.has(encounter.speciesId)).toBe(true);
      expect(encounter.speciesName.length).toBeGreaterThan(0);
    }
  });

  it("respects the weighted distribution (LeafCat is the most common)", () => {
    setRandomSource({ next: () => 0 });
    const encounter = generateEncounter(forest, "trainer-1");
    expect(encounter.speciesId).toBe(11); // first entry = LeafCat
  });

  it("generates unique encounter ids", () => {
    const a = generateEncounter(forest, "trainer-1");
    const b = generateEncounter(forest, "trainer-1");
    expect(a.id).not.toBe(b.id);
  });
});
