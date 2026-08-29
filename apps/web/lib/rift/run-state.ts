import { getRiftEvent, isRiftId } from "./config";
import { generateRiftRoute } from "./generator";
import type {
  RiftEventChoice,
  RiftId,
  RiftNode,
  RiftNodeStatus,
  RiftRunState,
} from "./types";

export const RIFT_SESSION_STORAGE_KEY = "chainmon:protocol-rift:run:v2";

export function createRiftRun(
  riftId: RiftId,
  seed: string,
  selectedMonsterIds: readonly string[],
  startedAt = new Date().toISOString(),
): RiftRunState {
  if (selectedMonsterIds.length < 1 || selectedMonsterIds.length > 3) {
    throw new Error("rift: select between one and three monsters");
  }
  if (new Set(selectedMonsterIds).size !== selectedMonsterIds.length) {
    throw new Error("rift: selected monsters must be unique");
  }
  generateRiftRoute(riftId, seed);

  return {
    version: 2,
    riftId,
    seed,
    status: "active",
    selectedMonsterIds: [...selectedMonsterIds],
    completedNodeIds: [],
    modifiers: [],
    eventDecisions: [],
    rewards: { battlesWon: 0, gold: 0, exp: 0, items: {} },
    startedAt,
  };
}

export function getNodeStatus(
  node: RiftNode,
  completedNodeIds: readonly string[],
): RiftNodeStatus {
  const completed = new Set(completedNodeIds);
  if (completed.has(node.id)) return "completed";
  if (node.parentIds.every((parentId) => completed.has(parentId))) {
    return "available";
  }
  return "locked";
}

export function enterRiftNode(run: RiftRunState, nodeId: string): RiftRunState {
  if (run.status !== "active") throw new Error("rift: this run is complete");
  const node = generateRiftRoute(run.riftId, run.seed).nodes.find(
    (candidate) => candidate.id === nodeId,
  );
  if (!node) throw new Error("rift: unknown node");
  if (getNodeStatus(node, run.completedNodeIds) !== "available") {
    throw new Error("rift: this node is locked");
  }
  return {
    ...run,
    activeNodeId: nodeId,
    activeBattleId: undefined,
    activeEncounterId: undefined,
  };
}

export function completeRiftNode(
  run: RiftRunState,
  nodeId: string,
  completedAt = new Date().toISOString(),
): RiftRunState {
  const map = generateRiftRoute(run.riftId, run.seed);
  const node = map.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new Error("rift: unknown node");
  if (run.activeNodeId !== nodeId) throw new Error("rift: node is not active");
  if (getNodeStatus(node, run.completedNodeIds) !== "available") {
    throw new Error("rift: node is not available");
  }

  const completedNodeIds = [...run.completedNodeIds, nodeId];
  const runComplete = map.nodes.every((candidate) =>
    completedNodeIds.includes(candidate.id),
  );
  return {
    ...run,
    completedNodeIds,
    activeNodeId: undefined,
    activeBattleId: undefined,
    activeEncounterId: undefined,
    modifiers: runComplete ? [] : run.modifiers,
    status: runComplete ? "completed" : "active",
    completedAt: runComplete ? completedAt : undefined,
  };
}

export function applyEventChoice(
  run: RiftRunState,
  choice: RiftEventChoice,
): RiftRunState {
  const nodeId = run.activeNodeId;
  if (!nodeId) throw new Error("rift: no active protocol event");
  const node = generateRiftRoute(run.riftId, run.seed).nodes.find(
    (candidate) => candidate.id === nodeId,
  );
  if (!node || node.type !== "protocol-event" || !node.eventId) {
    throw new Error("rift: active node is not a protocol event");
  }
  const event = getRiftEvent(node.eventId);
  if (!event || !event.choices.some((candidate) => candidate.id === choice.id)) {
    throw new Error("rift: choice does not belong to this event");
  }

  return completeRiftNode({
    ...run,
    modifiers: [...run.modifiers, { ...choice.modifier, sourceNodeId: nodeId }],
    eventDecisions: [
      ...run.eventDecisions,
      { nodeId, eventId: event.id, choiceId: choice.id },
    ],
  }, nodeId);
}

export function serializeRiftRun(run: RiftRunState): string {
  return JSON.stringify(run);
}

export function restoreRiftRun(serialized: string | null): RiftRunState | null {
  if (!serialized) return null;
  try {
    const value = JSON.parse(serialized) as Partial<RiftRunState>;
    if (
      value.version !== 2 ||
      !isRiftId(value.riftId) ||
      typeof value.seed !== "string" ||
      !value.seed.trim() ||
      (value.status !== "active" && value.status !== "completed") ||
      !Array.isArray(value.selectedMonsterIds) ||
      value.selectedMonsterIds.length < 1 ||
      value.selectedMonsterIds.length > 3 ||
      new Set(value.selectedMonsterIds).size !== value.selectedMonsterIds.length ||
      !Array.isArray(value.completedNodeIds) ||
      !Array.isArray(value.modifiers) ||
      !Array.isArray(value.eventDecisions) ||
      !value.rewards ||
      typeof value.startedAt !== "string"
    ) {
      return null;
    }

    const nodeIds = new Set(
      generateRiftRoute(value.riftId, value.seed).nodes.map((node) => node.id),
    );
    if (
      value.completedNodeIds.some((nodeId) => !nodeIds.has(nodeId)) ||
      (value.activeNodeId !== undefined && !nodeIds.has(value.activeNodeId))
    ) {
      return null;
    }
    return value as RiftRunState;
  } catch {
    return null;
  }
}
