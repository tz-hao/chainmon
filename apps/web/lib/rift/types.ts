import type { BattleRewardSettlement } from "@/lib/data";
import type { Element, Rarity } from "@chainmon/shared";

export const RIFT_IDS = [
  "liquidity-grove",
  "proof-network",
  "gas-wasteland",
  "credit-abyss",
] as const;

export type RiftId = (typeof RIFT_IDS)[number];

export type RiftNodeType =
  | "battle"
  | "capture"
  | "protocol-event"
  | "rest"
  | "elite"
  | "boss";

export type RiftNodeStatus = "locked" | "available" | "completed";

export interface RiftNode {
  id: string;
  index: number;
  type: RiftNodeType;
  title: string;
  subtitle: string;
  x: number;
  y: number;
  parentIds: string[];
  nextIds: string[];
  eventId?: string;
  enemySpeciesIds?: number[];
  enemyLevel?: number;
  statMultiplier?: number;
  captureSpeciesId?: number;
}

export interface RiftMap {
  id: RiftId;
  seed: string;
  name: string;
  nodes: RiftNode[];
}

export interface RiftRouteSlot {
  id: string;
  title: string;
  subtitle: string;
}

export interface RiftRouteTemplate {
  readonly openingEvent: RiftRouteSlot;
  readonly openingBattle: RiftRouteSlot;
  readonly capture: RiftRouteSlot;
  readonly convergenceEvent: RiftRouteSlot;
  readonly rest: RiftRouteSlot;
  readonly standardBattle: RiftRouteSlot;
  readonly elite: RiftRouteSlot;
  readonly boss: RiftRouteSlot;
}

export interface RiftConfig {
  id: RiftId;
  ordinal: string;
  name: string;
  eyebrow: string;
  description: string;
  concepts: readonly string[];
  difficulty: string;
  recommendedLevel: string;
  runDuration: string;
  featuredSpeciesIds: readonly number[];
  encounterPool: readonly number[];
  captureSpeciesIds: readonly number[];
  eliteSpeciesId: number;
  bossSpeciesId: number;
  bossTitle: string;
  eventIds: readonly string[];
  route: Readonly<RiftRouteTemplate>;
  levels: {
    opening: number;
    standard: number;
    elite: number;
    boss: number;
  };
  multipliers: {
    opening: number;
    standard: number;
    elite: number;
    boss: number;
  };
  summaryTitle: string;
}

export interface RiftMonsterView {
  id: string;
  speciesId: number;
  name: string;
  element: Element;
  rarity: Rarity;
  level: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
}

export type RiftModifierAxis = "signal" | "guard" | "tempo";

export interface RiftEventChoice {
  id: string;
  label: string;
  detail: string;
  modifier: {
    id: string;
    label: string;
    description: string;
    axis: RiftModifierAxis;
    amount: number;
  };
}

export interface RiftProtocolEvent {
  id: string;
  riftId: RiftId;
  protocol: string;
  title: string;
  premise: string;
  insight: string;
  choices: readonly [RiftEventChoice, RiftEventChoice];
}

export interface ActiveRiftModifier {
  id: string;
  label: string;
  description: string;
  axis: RiftModifierAxis;
  amount: number;
  sourceNodeId: string;
}

export interface RiftEventDecision {
  nodeId: string;
  eventId: string;
  choiceId: string;
}

export interface RiftCaptureSummary {
  monsterId: string;
  monsterName: string;
  speciesId: number;
}

export interface RiftRunRewards {
  battlesWon: number;
  gold: number;
  exp: number;
  items: Record<string, number>;
  capture?: RiftCaptureSummary;
}

export interface RiftRunState {
  version: 2;
  riftId: RiftId;
  seed: string;
  status: "active" | "completed";
  selectedMonsterIds: string[];
  completedNodeIds: string[];
  activeNodeId?: string;
  activeBattleId?: string;
  activeEncounterId?: string;
  modifiers: ActiveRiftModifier[];
  eventDecisions: RiftEventDecision[];
  rewards: RiftRunRewards;
  startedAt: string;
  completedAt?: string;
}

export interface RiftBattleSettlement {
  stateId: string;
  rewards: BattleRewardSettlement | null;
}
