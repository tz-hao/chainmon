import { describe, expect, it } from "vitest";
import {
  randomChoice,
  randomFloat,
  randomId,
  randomInt,
  resetRandomSource,
  setRandomSource,
} from "../random";

describe("randomInt", () => {
  it("returns integers within [min, max] inclusive", () => {
    for (let i = 0; i < 500; i++) {
      const value = randomInt(1, 6);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
    }
  });

  it("handles min === max", () => {
    expect(randomInt(5, 5)).toBe(5);
  });

  it("covers both endpoints over many samples", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      seen.add(randomInt(0, 3));
    }
    expect(seen.has(0)).toBe(true);
    expect(seen.has(3)).toBe(true);
  });

  it("throws on invalid ranges", () => {
    expect(() => randomInt(3, 1)).toThrow();
    expect(() => randomInt(1.5, 3)).toThrow();
  });

  it("respects the injected random source", () => {
    setRandomSource({ next: () => 0.999 });
    expect(randomInt(0, 9)).toBe(9);
    setRandomSource({ next: () => 0 });
    expect(randomInt(0, 9)).toBe(0);
    resetRandomSource();
  });
});

describe("randomFloat", () => {
  it("returns floats in [min, max)", () => {
    for (let i = 0; i < 500; i++) {
      const value = randomFloat(0.9, 1.1);
      expect(value).toBeGreaterThanOrEqual(0.9);
      expect(value).toBeLessThan(1.1);
    }
  });

  it("throws when min > max", () => {
    expect(() => randomFloat(5, 1)).toThrow();
  });
});

describe("randomChoice", () => {
  it("returns an element of the array", () => {
    const items = ["a", "b", "c"];
    for (let i = 0; i < 200; i++) {
      expect(items).toContain(randomChoice(items));
    }
  });

  it("throws on an empty array", () => {
    expect(() => randomChoice([])).toThrow();
  });
});

describe("randomId", () => {
  it("produces non-empty unique ids", () => {
    const first = randomId();
    const second = randomId();
    expect(first.length).toBeGreaterThan(0);
    expect(first).not.toBe(second);
  });
});
