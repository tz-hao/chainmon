import type { Element } from "@chainmon/shared";
import { describe, expect, it } from "vitest";
import { getElementMultiplier } from "../elements";

const ADVANTAGES: readonly [Element, Element, number][] = [
  ["fire", "nature", 1.5],
  ["nature", "water", 1.5],
  ["water", "fire", 1.5],
  ["electric", "water", 1.5],
];

const RESISTED: readonly [Element, Element, number][] = [
  ["fire", "water", 0.75],
  ["water", "nature", 0.75],
  ["water", "electric", 0.75],
  ["nature", "fire", 0.75],
];

const NEUTRAL: readonly [Element, Element][] = [
  ["fire", "electric"],
  ["electric", "fire"],
  ["nature", "electric"],
  ["electric", "nature"],
  ["fire", "fire"],
  ["water", "water"],
  ["nature", "nature"],
  ["electric", "electric"],
];

describe("getElementMultiplier", () => {
  it("applies 1.5x for super-effective attacks", () => {
    for (const [attacker, defender, expected] of ADVANTAGES) {
      expect(getElementMultiplier(attacker, defender), `${attacker}→${defender}`).toBe(expected);
    }
  });

  it("applies 0.75x for resisted attacks", () => {
    for (const [attacker, defender, expected] of RESISTED) {
      expect(getElementMultiplier(attacker, defender), `${attacker}→${defender}`).toBe(expected);
    }
  });

  it("applies 1.0x for neutral combinations", () => {
    for (const [attacker, defender] of NEUTRAL) {
      expect(getElementMultiplier(attacker, defender), `${attacker}→${defender}`).toBe(1.0);
    }
  });
});
