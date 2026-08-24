/**
 * ChainMon Pixel World — monster visual manifest.
 * Central registry: speciesId → sprite paths. All UI/Phaser lookups go
 * through here (never hardcode paths in components).
 *
 * Asset priority:
 *   1. Real PNG assets under public/game/monsters/<id3>-<slug>/... (when present)
 *   2. Programmatic pixel-art generation (runtime fallback, MVP visual)
 */

import { getSpeciesById } from "@chainmon/monster-data";

export type MonsterVisualKind = "overworld" | "battle-front" | "portrait";

export interface MonsterVisualEntry {
  speciesId: number;
  slug: string;
  overworld: string;
  battleFront: string;
  portrait: string;
}

function pad3(id: number): string {
  return String(id).padStart(3, "0");
}

/** Manifest: 1–28 (paths stay stable; art files can be dropped in later). */
export const MONSTER_VISUALS: readonly MonsterVisualEntry[] = Array.from(
  { length: 28 },
  (_, i) => {
    const speciesId = i + 1;
    const species = getSpeciesById(speciesId);
    const slug = species?.slug ?? `monster-${speciesId}`;
    const base = `/game/monsters/${pad3(speciesId)}-${slug}`;
    return {
      speciesId,
      slug,
      overworld: `${base}/overworld.png`,
      battleFront: `${base}/battle-front.png`,
      portrait: `${base}/portrait.png`,
    };
  },
);

export function getVisualBySpeciesId(speciesId: number): MonsterVisualEntry {
  const entry = MONSTER_VISUALS.find((v) => v.speciesId === speciesId);
  if (!entry) throw new Error(`monster-visuals: unknown speciesId ${speciesId}`);
  return entry;
}

export function getMonsterVisualPath(
  speciesId: number,
  kind: MonsterVisualKind,
): string {
  const entry = getVisualBySpeciesId(speciesId);
  switch (kind) {
    case "overworld":
      return entry.overworld;
    case "battle-front":
      return entry.battleFront;
    case "portrait":
      return entry.portrait;
  }
}

/**
 * Palette per species (8-16 colors max) used by the runtime pixel-art
 * generator. Distinct silhouettes via shape templates below.
 */
export interface SpeciesPalette {
  body: string;
  bodyDark: string;
  accent: string;
  accent2: string;
  eye: string;
  outline: string;
}

export function paletteForSpecies(speciesId: number): SpeciesPalette {
  const palettes: Record<number, SpeciesPalette> = {
    1: { body: "#e8633a", bodyDark: "#a83a1e", accent: "#ffb347", accent2: "#ffd9a0", eye: "#1c1410", outline: "#571f0e" }, // FireCub
    2: { body: "#d9482b", bodyDark: "#8f2c15", accent: "#ff8c42", accent2: "#ffca7a", eye: "#1a1008", outline: "#4a1a0c" }, // FireWolf
    3: { body: "#c73e20", bodyDark: "#7c2410", accent: "#ff9d00", accent2: "#ffe08a", eye: "#150d06", outline: "#3c1307" }, // InfernoWolf
    4: { body: "#f0783c", bodyDark: "#b34f1e", accent: "#ffd166", accent2: "#fff3c4", eye: "#221407", outline: "#5c2410" }, // EmberFox
    5: { body: "#b0411e", bodyDark: "#6f2410", accent: "#e06a2a", accent2: "#ffb066", eye: "#1c0f06", outline: "#3e1206" }, // MagmaBoar
    6: { body: "#3aa8c1", bodyDark: "#1e6a80", accent: "#7fd4e8", accent2: "#c9f2f7", eye: "#0d1c20", outline: "#0e3a47" }, // AquaTurtle
    7: { body: "#4ab3d8", bodyDark: "#256e8a", accent: "#8fe3f2", accent2: "#d8f8fb", eye: "#0c1d24", outline: "#123c4d" }, // BubbleFin
    8: { body: "#5bb8d4", bodyDark: "#2c7490", accent: "#a3e6f5", accent2: "#e3fafc", eye: "#102028", outline: "#163e50" }, // TideOtter
    9: { body: "#2e8fa8", bodyDark: "#175469", accent: "#66c8dd", accent2: "#b8eef4", eye: "#081a20", outline: "#0b3544" }, // CoralSerpent
    10: { body: "#264b62", bodyDark: "#12283a", accent: "#4d8ba6", accent2: "#9cc8d8", eye: "#061218", outline: "#081a26" }, // AbyssShark
    11: { body: "#5fae3e", bodyDark: "#37701f", accent: "#8fd465", accent2: "#d3f0b5", eye: "#12200a", outline: "#1c4010" }, // LeafCat
    12: { body: "#6fbf4a", bodyDark: "#3f7a26", accent: "#a3e070", accent2: "#e0f7c6", eye: "#14240c", outline: "#204514" }, // BloomMantis
    13: { body: "#4f8f3a", bodyDark: "#2c551f", accent: "#7fbc60", accent2: "#c8e8b2", eye: "#101d0a", outline: "#1a3512" }, // MossBear
    14: { body: "#8a9a4a", bodyDark: "#525e27", accent: "#b4c46e", accent2: "#e2ebbd", eye: "#141b08", outline: "#2e3514" }, // ThornDeer
    15: { body: "#3d6e2e", bodyDark: "#1f3d16", accent: "#689f4d", accent2: "#aed89a", eye: "#0c1708", outline: "#14260d" }, // AncientTreant
    16: { body: "#f2d23a", bodyDark: "#a8891a", accent: "#ffe96e", accent2: "#fff7c2", eye: "#1c1505", outline: "#58440a" }, // SparkMouse
    17: { body: "#e8c832", bodyDark: "#9c8418", accent: "#fbe45e", accent2: "#fdf3b0", eye: "#191206", outline: "#4e3b08" }, // StaticLynx
    18: { body: "#2f6fd8", bodyDark: "#17428c", accent: "#5b97f0", accent2: "#b7d4fb", eye: "#0a1528", outline: "#0c2450" }, // StormDragon
    19: { body: "#f5e13c", bodyDark: "#a69618", accent: "#ffef70", accent2: "#fff9c8", eye: "#1e1804", outline: "#5a4d06" }, // VoltHare
    20: { body: "#3a7ee0", bodyDark: "#1c4a94", accent: "#6aa5f2", accent2: "#c4dcfb", eye: "#0b162a", outline: "#0d2752" }, // ThunderBird
    21: { body: "#b48ae0", bodyDark: "#6e4a96", accent: "#e3c8f5", accent2: "#f7ecfd", eye: "#1c1028", outline: "#3c2654" }, // Swapicorn (purple/white)
    22: { body: "#2c4a7c", bodyDark: "#162a4a", accent: "#d4a12a", accent2: "#f2dc9c", eye: "#f2dc9c", outline: "#0c1a30" }, // OracleOwl (dark blue + gold data feathers)
    23: { body: "#3c2a5e", bodyDark: "#1f1434", accent: "#2ee0d0", accent2: "#a8f5ec", eye: "#2ee0d0", outline: "#100a1e" }, // ZkBat (black/purple, cyan)
    24: { body: "#e8822a", bodyDark: "#9c5012", accent: "#f0b04a", accent2: "#f8dcae", eye: "#201207", outline: "#54290a" }, // BridgeFox (orange, two tails)
    25: { body: "#5aa7e8", bodyDark: "#2e6296", accent: "#a8d6f8", accent2: "#e3f4fe", eye: "#101c28", outline: "#173450" }, // Lendgeist (transparent blue ghost)
    26: { body: "#8fae3a", bodyDark: "#546a1c", accent: "#c6e060", accent2: "#e9f6b0", eye: "#161f08", outline: "#2c3a10" }, // GasGoblin (green goblin)
    27: { body: "#4f9e3c", bodyDark: "#2a5c1e", accent: "#82cc5c", accent2: "#c8efaa", eye: "#101f0a", outline: "#18340f" }, // MevMantis (mechanical mantis)
    28: { body: "#3e5f78", bodyDark: "#22384a", accent: "#7fa8c2", accent2: "#c4dce8", eye: "#0c141c", outline: "#12202c" }, // VaultTurtle (mechanical turtle)
  };
  return palettes[speciesId] ?? palettes[1]!;
}

/**
 * Shape template id per species (runtime pixel generator): each template
 * draws a distinct silhouette so every species is recognizable.
 */
export function shapeForSpecies(speciesId: number): string {
  const shapes = [
    "cub", "wolf", "wolf-large", "fox", "boar",
    "turtle", "fin", "otter", "serpent", "shark",
    "cat", "mantis", "bear", "deer", "treant",
    "mouse", "lynx", "dragon", "hare", "bird",
    "unicorn", "owl", "bat", "fox-two-tail", "ghost",
    "goblin", "mantis-mech", "turtle-vault",
  ];
  return shapes[(speciesId - 1) % shapes.length] ?? "cub";
}
