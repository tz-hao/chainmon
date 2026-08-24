import { describe, expect, it } from "vitest";
import { weightedRandom, type RandomSource } from "../random";

const source = (value: number): RandomSource => ({ next: () => value });

describe("weightedRandom", () => {
  it("returns the only entry for a single-entry list", () => {
    const result = weightedRandom([{ value: "only", weight: 5 }]);
    expect(result).toBe("only");
  });

  it("is deterministic with an injected RandomSource", () => {
    // roll = 0 → lands inside the first entry
    expect(
      weightedRandom(
        [
          { value: "a", weight: 1 },
          { value: "b", weight: 1 },
        ],
        source(0),
      ),
    ).toBe("a");
    // roll = 0.999 → lands inside the last entry
    expect(
      weightedRandom(
        [
          { value: "a", weight: 1 },
          { value: "b", weight: 1 },
        ],
        source(0.999),
      ),
    ).toBe("b");
  });

  it("respects different weights", () => {
    // total = 100; roll = 0.5 → 50 → inside "a" (weight 99)
    expect(
      weightedRandom(
        [
          { value: "a", weight: 99 },
          { value: "b", weight: 1 },
        ],
        source(0.5),
      ),
    ).toBe("a");
    // total = 100; roll = 0.5 → 50 → inside "b" (weight 1 + 99)
    expect(
      weightedRandom(
        [
          { value: "a", weight: 1 },
          { value: "b", weight: 99 },
        ],
        source(0.5),
      ),
    ).toBe("b");
  });

  it("throws a clear error on an empty list", () => {
    expect(() => weightedRandom([])).toThrow(/empty/i);
  });

  it("throws a clear error on zero weights", () => {
    expect(() =>
      weightedRandom([
        { value: "a", weight: 0 },
        { value: "b", weight: 1 },
      ]),
    ).toThrow(/positive/i);
  });

  it("throws a clear error on negative weights", () => {
    expect(() =>
      weightedRandom([
        { value: "a", weight: -2 },
        { value: "b", weight: 1 },
      ]),
    ).toThrow(/positive/i);
  });

  it("does not mutate the input array", () => {
    const entries = [
      { value: "a", weight: 1 },
      { value: "b", weight: 2 },
    ];
    const snapshot = JSON.stringify(entries);
    weightedRandom(entries, source(0.5));
    expect(JSON.stringify(entries)).toBe(snapshot);
  });
});
