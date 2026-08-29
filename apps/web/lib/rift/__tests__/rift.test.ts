import { describe, expect, it } from "vitest";
import { getSpeciesById } from "@chainmon/monster-data";
import {
  RIFT_CONFIGS,
  RIFT_PROTOCOL_EVENTS,
  getRiftEvent,
} from "../config";
import { generateRiftRoute } from "../generator";
import {
  applyEventChoice,
  completeRiftNode,
  createRiftRun,
  enterRiftNode,
  getNodeStatus,
  restoreRiftRun,
  serializeRiftRun,
} from "../run-state";

const TEAM = ["monster-a", "monster-b", "monster-c"];
const NODE_TYPES = [
  "protocol-event",
  "battle",
  "capture",
  "protocol-event",
  "rest",
  "battle",
  "elite",
  "boss",
];

describe("Four-Rift configuration and generator", () => {
  it("ships exactly four configured Rift environments", () => {
    expect(RIFT_CONFIGS.map((rift) => rift.id)).toEqual([
      "liquidity-grove",
      "proof-network",
      "gas-wasteland",
      "credit-abyss",
    ]);
    expect(new Set(RIFT_PROTOCOL_EVENTS.map((event) => event.id)).size).toBe(
      RIFT_PROTOCOL_EVENTS.length,
    );
    for (const rift of RIFT_CONFIGS) {
      for (const speciesId of [
        ...rift.featuredSpeciesIds,
        ...rift.encounterPool,
        ...rift.captureSpeciesIds,
        rift.eliteSpeciesId,
        rift.bossSpeciesId,
      ]) {
        expect(getSpeciesById(speciesId), `${rift.id}:${speciesId}`).toBeDefined();
      }
      for (const eventId of rift.eventIds) {
        expect(getRiftEvent(eventId)?.riftId).toBe(rift.id);
      }
    }
  });

  it.each(RIFT_CONFIGS)("generates the configured eight-node topology for $name", (rift) => {
    const first = generateRiftRoute(rift.id, "deterministic-seed");
    const second = generateRiftRoute(rift.id, "deterministic-seed");

    expect(second).toEqual(first);
    expect(first.name).toBe(rift.name);
    expect(first.nodes).toHaveLength(8);
    expect(first.nodes.map((node) => node.type)).toEqual(NODE_TYPES);
    expect(first.nodes.at(-1)?.enemySpeciesIds?.[0]).toBe(rift.bossSpeciesId);
    expect(first.nodes.find((node) => node.type === "capture")?.captureSpeciesId).toBe(
      rift.captureSpeciesIds[0],
    );
    for (const eventId of rift.eventIds) {
      const event = getRiftEvent(eventId);
      expect(event?.riftId).toBe(rift.id);
      expect(event?.choices).toHaveLength(2);
    }
  });
});

describe("Protocol Rift progression", () => {
  it.each(RIFT_CONFIGS)("keeps $name's convergence path locked until both openings clear", (rift) => {
    const map = generateRiftRoute(rift.id, "locked-paths");
    let run = createRiftRun(rift.id, "locked-paths", TEAM, "2026-08-29T00:00:00.000Z");
    const ingress = map.nodes[0]!;
    const firstChoice = getRiftEvent(ingress.eventId!)!.choices[0];

    run = enterRiftNode(run, ingress.id);
    run = applyEventChoice(run, firstChoice);
    run = enterRiftNode(run, map.nodes[1]!.id);
    run = completeRiftNode(run, map.nodes[1]!.id);

    expect(getNodeStatus(map.nodes[3]!, run.completedNodeIds)).toBe("locked");
    expect(() => enterRiftNode(run, map.nodes[3]!.id)).toThrow(/locked/);

    run = enterRiftNode(run, map.nodes[2]!.id);
    run = completeRiftNode(run, map.nodes[2]!.id);
    expect(getNodeStatus(map.nodes[3]!, run.completedNodeIds)).toBe("available");
  });

  it("applies event choices only to the active run and expires them on a new run", () => {
    const riftId = "proof-network";
    const map = generateRiftRoute(riftId, "event-choice");
    const node = map.nodes[0]!;
    const event = getRiftEvent(node.eventId!)!;
    let run = createRiftRun(riftId, "event-choice", [TEAM[0]!]);

    run = enterRiftNode(run, node.id);
    run = applyEventChoice(run, event.choices[1]);

    expect(run.modifiers[0]?.sourceNodeId).toBe(node.id);
    expect(run.eventDecisions).toEqual([
      { nodeId: node.id, eventId: event.id, choiceId: event.choices[1].id },
    ]);
    expect(createRiftRun(riftId, "fresh-run", [TEAM[0]!]).modifiers).toEqual([]);
  });

  it("completes a full route only after its configured boss", () => {
    const riftId = "gas-wasteland";
    const map = generateRiftRoute(riftId, "full-route");
    let run = createRiftRun(riftId, "full-route", TEAM, "2026-08-29T00:00:00.000Z");

    for (const node of map.nodes) {
      run = enterRiftNode(run, node.id);
      if (node.type === "protocol-event") {
        run = applyEventChoice(run, getRiftEvent(node.eventId!)!.choices[0]);
      } else {
        run = completeRiftNode(run, node.id, "2026-08-29T00:08:00.000Z");
      }
    }

    expect(run.status).toBe("completed");
    expect(run.completedNodeIds).toHaveLength(8);
    expect(run.completedAt).toBe("2026-08-29T00:08:00.000Z");
  });
});

describe("Protocol Rift session recovery", () => {
  it("round-trips a v2 run with its selected Rift", () => {
    const riftId = "credit-abyss";
    let run = createRiftRun(riftId, "recovery", TEAM, "2026-08-29T00:00:00.000Z");
    const ingress = generateRiftRoute(riftId, "recovery").nodes[0]!;
    run = enterRiftNode(run, ingress.id);

    expect(restoreRiftRun(serializeRiftRun(run))).toEqual(run);
  });

  it("rejects malformed, pre-expansion and unknown-node session data", () => {
    const run = createRiftRun("liquidity-grove", "corrupt", TEAM);
    expect(restoreRiftRun("not-json")).toBeNull();
    expect(restoreRiftRun(JSON.stringify({ ...run, version: 1 }))).toBeNull();
    expect(restoreRiftRun(JSON.stringify({ ...run, activeNodeId: "forged-node" }))).toBeNull();
  });
});
