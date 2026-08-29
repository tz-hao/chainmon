import { getRiftConfig, getRiftEvent } from "./config";
import type { RiftId, RiftMap, RiftNode } from "./types";

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: string): () => number {
  let state = hashSeed(seed) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target]!, result[index]!];
  }
  return result;
}

function nodeId(riftId: RiftId, slotId: string): string {
  return `${riftId}:${slotId}`;
}

export function generateRiftRoute(riftId: RiftId, seed: string): RiftMap {
  if (!seed.trim()) throw new Error("rift: a non-empty seed is required");

  const config = getRiftConfig(riftId);
  const route = config.route;
  const random = createSeededRandom(`${riftId}:${seed}`);
  const events = shuffle(config.eventIds, random)
    .slice(0, 2)
    .map((eventId) => getRiftEvent(eventId));
  const [openingEvent, convergenceEvent] = events;
  if (!openingEvent || !convergenceEvent) {
    throw new Error(`rift: ${riftId} must define at least two protocol events`);
  }

  const openingEnemies = shuffle(config.encounterPool, random).slice(0, 3);
  const standardEnemies = shuffle(config.encounterPool, random).slice(0, 3);
  const captureSpeciesId = shuffle(config.captureSpeciesIds, random)[0];
  if (!captureSpeciesId) throw new Error(`rift: ${riftId} must define a capture species`);

  const bossSupport = shuffle(
    config.encounterPool.filter((speciesId) => speciesId !== config.bossSpeciesId),
    random,
  ).slice(0, 2);
  const ingressId = nodeId(riftId, route.openingEvent.id);
  const openingBattleId = nodeId(riftId, route.openingBattle.id);
  const captureId = nodeId(riftId, route.capture.id);
  const convergenceId = nodeId(riftId, route.convergenceEvent.id);
  const restId = nodeId(riftId, route.rest.id);
  const standardBattleId = nodeId(riftId, route.standardBattle.id);
  const eliteId = nodeId(riftId, route.elite.id);
  const bossId = nodeId(riftId, route.boss.id);

  const nodes: RiftNode[] = [
    {
      id: ingressId,
      index: 0,
      type: "protocol-event",
      title: openingEvent.title,
      subtitle: `${openingEvent.protocol} · protocol decision`,
      x: 5,
      y: 50,
      parentIds: [],
      nextIds: [openingBattleId, captureId],
      eventId: openingEvent.id,
    },
    {
      id: openingBattleId,
      index: 1,
      type: "battle",
      title: route.openingBattle.title,
      subtitle: route.openingBattle.subtitle,
      x: 20,
      y: 25,
      parentIds: [ingressId],
      nextIds: [convergenceId],
      enemySpeciesIds: openingEnemies,
      enemyLevel: config.levels.opening,
      statMultiplier: config.multipliers.opening,
    },
    {
      id: captureId,
      index: 2,
      type: "capture",
      title: route.capture.title,
      subtitle: route.capture.subtitle,
      x: 20,
      y: 75,
      parentIds: [ingressId],
      nextIds: [convergenceId],
      captureSpeciesId,
    },
    {
      id: convergenceId,
      index: 3,
      type: "protocol-event",
      title: convergenceEvent.title,
      subtitle: `${convergenceEvent.protocol} · protocol decision`,
      x: 36,
      y: 50,
      parentIds: [openingBattleId, captureId],
      nextIds: [restId],
      eventId: convergenceEvent.id,
    },
    {
      id: restId,
      index: 4,
      type: "rest",
      title: route.rest.title,
      subtitle: route.rest.subtitle,
      x: 51,
      y: 50,
      parentIds: [convergenceId],
      nextIds: [standardBattleId],
    },
    {
      id: standardBattleId,
      index: 5,
      type: "battle",
      title: route.standardBattle.title,
      subtitle: route.standardBattle.subtitle,
      x: 66,
      y: 50,
      parentIds: [restId],
      nextIds: [eliteId],
      enemySpeciesIds: standardEnemies,
      enemyLevel: config.levels.standard,
      statMultiplier: config.multipliers.standard,
    },
    {
      id: eliteId,
      index: 6,
      type: "elite",
      title: route.elite.title,
      subtitle: route.elite.subtitle,
      x: 81,
      y: 50,
      parentIds: [standardBattleId],
      nextIds: [bossId],
      enemySpeciesIds: [config.eliteSpeciesId, ...openingEnemies.slice(0, 2)],
      enemyLevel: config.levels.elite,
      statMultiplier: config.multipliers.elite,
    },
    {
      id: bossId,
      index: 7,
      type: "boss",
      title: config.bossTitle,
      subtitle: route.boss.subtitle,
      x: 96,
      y: 50,
      parentIds: [eliteId],
      nextIds: [],
      enemySpeciesIds: [config.bossSpeciesId, ...bossSupport],
      enemyLevel: config.levels.boss,
      statMultiplier: config.multipliers.boss,
    },
  ];

  return { id: riftId, seed, name: config.name, nodes };
}

export function getRiftNode(
  riftId: RiftId,
  seed: string,
  targetNodeId: string,
): RiftNode | undefined {
  return generateRiftRoute(riftId, seed).nodes.find((node) => node.id === targetNodeId);
}
