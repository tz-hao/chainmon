import type { ZoneId } from "./world-types";

export const WORLD_MAP_IDS = [
  "whispering-forest",
  "azure-lake",
  "ember-volcano",
  "power-station",
] as const;

export type WorldMapId = (typeof WORLD_MAP_IDS)[number];

export interface WorldMapDefinition {
  id: WorldMapId;
  name: string;
  chineseName: string;
  element: "Nature" | "Water" | "Fire" | "Electric";
  description: string;
  spawnPoint: { x: number; y: number };
  /** Existing canonical spawn tables reused by this visual world. */
  spawnZones: readonly ZoneId[];
  featuredSpecies: readonly string[];
}

export const WORLD_MAPS: readonly WorldMapDefinition[] = [
  {
    id: "whispering-forest",
    name: "Whispering Forest",
    chineseName: "低语森林",
    element: "Nature",
    description: "穿过林间小径，寻找自然系与 Web3 精灵。",
    spawnPoint: { x: 30, y: 27 },
    spawnZones: ["forest", "grove"],
    featuredSpecies: ["Swapicorn", "OracleOwl", "MevMantis"],
  },
  {
    id: "azure-lake",
    name: "Azure Lake",
    chineseName: "蔚蓝湖泊",
    element: "Water",
    description: "沿着湖岸、栈桥和芦苇探索稀有水系精灵。",
    spawnPoint: { x: 30, y: 27 },
    spawnZones: ["lake", "vault"],
    featuredSpecies: ["Lendgeist", "VaultTurtle"],
  },
  {
    id: "ember-volcano",
    name: "Ember Volcano",
    chineseName: "余烬火山",
    element: "Fire",
    description: "绕开熔岩和黑岩，进入火山洞口附近的热区。",
    spawnPoint: { x: 30, y: 27 },
    spawnZones: ["volcano"],
    featuredSpecies: ["GasGoblin", "BridgeFox", "FlameCub"],
  },
  {
    id: "power-station",
    name: "Power Station",
    chineseName: "发电厂",
    element: "Electric",
    description: "在电塔、管道与工业道路之间寻找电系精灵。",
    spawnPoint: { x: 30, y: 27 },
    spawnZones: ["power-zone"],
    featuredSpecies: ["ZkBat", "VoltCub", "PulseHare"],
  },
];

export function isWorldMapId(value: string | null | undefined): value is WorldMapId {
  return WORLD_MAP_IDS.includes(value as WorldMapId);
}

/** Migrates the old single-world value without trusting arbitrary stored strings. */
export function normalizeWorldMapId(value: string | null | undefined): WorldMapId {
  return isWorldMapId(value) ? value : "whispering-forest";
}

export function getWorldMapDefinition(value: string | null | undefined): WorldMapDefinition {
  const id = normalizeWorldMapId(value);
  return WORLD_MAPS.find((map) => map.id === id)!;
}
