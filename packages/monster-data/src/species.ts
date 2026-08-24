/**
 * @chainmon/monster-data — species.ts
 * The 20 monster species of ChainMon (Phase 2).
 *
 * Distribution:  5 per element (Fire / Water / Nature / Electric)
 * Rarity spread: Common 8 · Rare 6 · Epic 4 · Legendary 2
 *
 * Base stat budgets (total HP+ATK+DEF+SPD):
 *   Common 180-230 · Rare 220-270 · Epic 260-310 · Legendary 300-340
 *
 * Archetypes:
 *   Fire     — high Attack, mid Speed, low Defense
 *   Water    — HP / Defense oriented
 *   Nature   — HP / Defense / utility
 *   Electric — Speed oriented
 *
 * Evolution: FireCub →(16)→ FireWolf →(32 + Fire Stone)→ InfernoWolf
 */

import type { Element, Rarity } from "@chainmon/shared";

export interface LearnableSkillEntry {
  skillId: string;
  unlockLevel: number;
}

export interface SpeciesEvolution {
  /** id of the species this one evolves FROM */
  evolvesFrom?: number;
  /** id of the species this one evolves INTO */
  evolvesTo?: number;
  /** required level for the evolution */
  level?: number;
  /** required evolution material (e.g. "Fire Stone") */
  item?: string;
}

export interface MonsterSpeciesData {
  id: number;
  slug: string;
  name: string;
  description: string;
  element: Element;
  rarity: Rarity;
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;
  /** Base catch rate — canonical unit is 0-1 (e.g. 0.55 = 55%). */
  catchRate: number;
  evolution?: SpeciesEvolution;
  /** 2-4 learnable skills; Phase 2 only supports unlockLevel 1. */
  learnableSkills: LearnableSkillEntry[];
  image: string;
}

export const MONSTER_SPECIES: readonly MonsterSpeciesData[] = [
  // ============================== FIRE ==============================
  {
    id: 1,
    slug: "firecub",
    name: "FireCub",
    description:
      "A playful cub whose fur smoulders when excited. Loyal and brave, it never backs down from a challenge.",
    element: "fire",
    rarity: "common",
    baseHp: 55,
    baseAttack: 65,
    baseDefense: 35,
    baseSpeed: 45,
    catchRate: 0.55,
    evolution: { evolvesTo: 2, level: 16 },
    learnableSkills: [
      { skillId: "ember", unlockLevel: 1 },
      { skillId: "fire-fang", unlockLevel: 1 },
      { skillId: "flame-burst", unlockLevel: 8 },
    ],
    image: "/monsters/firecub.svg",
  },
  {
    id: 2,
    slug: "firewolf",
    name: "FireWolf",
    description:
      "The evolved form of FireCub. Its howl can ignite dry grass from a distance and its fangs burn like coals.",
    element: "fire",
    rarity: "rare",
    baseHp: 65,
    baseAttack: 85,
    baseDefense: 45,
    baseSpeed: 55,
    catchRate: 0.3,
    evolution: { evolvesFrom: 1, evolvesTo: 3, level: 32, item: "Fire Stone" },
    learnableSkills: [
      { skillId: "ember", unlockLevel: 1 },
      { skillId: "fire-fang", unlockLevel: 1 },
      { skillId: "flame-burst", unlockLevel: 1 },
      { skillId: "inferno-blast", unlockLevel: 18 },
    ],
    image: "/monsters/firewolf.svg",
  },
  {
    id: 3,
    slug: "infernowolf",
    name: "InfernoWolf",
    description:
      "The final evolution of FireCub. Wreathed in an eternal blaze, it is said that its bite can melt stone.",
    element: "fire",
    rarity: "epic",
    baseHp: 75,
    baseAttack: 100,
    baseDefense: 55,
    baseSpeed: 65,
    catchRate: 0.16,
    evolution: { evolvesFrom: 2 },
    learnableSkills: [
      { skillId: "fire-fang", unlockLevel: 1 },
      { skillId: "flame-burst", unlockLevel: 1 },
      { skillId: "inferno-blast", unlockLevel: 1 },
    ],
    image: "/monsters/infernowolf.svg",
  },
  {
    id: 4,
    slug: "emberfox",
    name: "EmberFox",
    description:
      "A cunning fox whose nine tails spark with embers. It moves like a flame and strikes before foes react.",
    element: "fire",
    rarity: "rare",
    baseHp: 55,
    baseAttack: 75,
    baseDefense: 40,
    baseSpeed: 70,
    catchRate: 0.32,
    learnableSkills: [
      { skillId: "ember", unlockLevel: 1 },
      { skillId: "flame-burst", unlockLevel: 1 },
      { skillId: "inferno-blast", unlockLevel: 20 },
    ],
    image: "/monsters/emberfox.svg",
  },
  {
    id: 5,
    slug: "magmaboar",
    name: "MagmaBoar",
    description:
      "A thick-skinned boar that sleeps inside volcanoes. Slow, but its charge carries the force of an eruption.",
    element: "fire",
    rarity: "common",
    baseHp: 70,
    baseAttack: 60,
    baseDefense: 40,
    baseSpeed: 30,
    catchRate: 0.5,
    learnableSkills: [
      { skillId: "ember", unlockLevel: 1 },
      { skillId: "fire-fang", unlockLevel: 1 },
      { skillId: "flame-burst", unlockLevel: 10 },
    ],
    image: "/monsters/magmaboar.svg",
  },

  // ============================== WATER ==============================
  {
    id: 6,
    slug: "aquaturtle",
    name: "AquaTurtle",
    description:
      "A gentle turtle with a shell like a coral reef. Its calm patience makes it a natural defender.",
    element: "water",
    rarity: "common",
    baseHp: 70,
    baseAttack: 45,
    baseDefense: 60,
    baseSpeed: 25,
    catchRate: 0.55,
    learnableSkills: [
      { skillId: "water-gun", unlockLevel: 1 },
      { skillId: "bubble-beam", unlockLevel: 1 },
      { skillId: "aqua-tail", unlockLevel: 12 },
    ],
    image: "/monsters/aquaturtle.svg",
  },
  {
    id: 7,
    slug: "bubblefin",
    name: "BubbleFin",
    description:
      "A cheerful fish that blows glittering bubbles. It patrols shallow waters and is easy to befriend.",
    element: "water",
    rarity: "common",
    baseHp: 60,
    baseAttack: 50,
    baseDefense: 50,
    baseSpeed: 40,
    catchRate: 0.52,
    learnableSkills: [
      { skillId: "water-gun", unlockLevel: 1 },
      { skillId: "bubble-beam", unlockLevel: 1 },
    ],
    image: "/monsters/bubblefin.svg",
  },
  {
    id: 8,
    slug: "tideotter",
    name: "TideOtter",
    description:
      "A swift otter that rides the tide. Playful in shallows, relentless when its territory is threatened.",
    element: "water",
    rarity: "rare",
    baseHp: 65,
    baseAttack: 65,
    baseDefense: 55,
    baseSpeed: 45,
    catchRate: 0.32,
    learnableSkills: [
      { skillId: "water-gun", unlockLevel: 1 },
      { skillId: "aqua-tail", unlockLevel: 1 },
      { skillId: "hydro-cannon", unlockLevel: 18 },
    ],
    image: "/monsters/tideotter.svg",
  },
  {
    id: 9,
    slug: "coralserpent",
    name: "CoralSerpent",
    description:
      "A reef-dwelling serpent armoured in living coral. Its scales harden with every battle it survives.",
    element: "water",
    rarity: "epic",
    baseHp: 80,
    baseAttack: 70,
    baseDefense: 80,
    baseSpeed: 50,
    catchRate: 0.18,
    learnableSkills: [
      { skillId: "bubble-beam", unlockLevel: 1 },
      { skillId: "aqua-tail", unlockLevel: 1 },
      { skillId: "hydro-cannon", unlockLevel: 1 },
    ],
    image: "/monsters/coralserpent.svg",
  },
  {
    id: 10,
    slug: "abyssshark",
    name: "AbyssShark",
    description:
      "A predator from the ocean depths, feared by every sailor. Legends say it surfaces only when a storm is near.",
    element: "water",
    rarity: "legendary",
    baseHp: 85,
    baseAttack: 95,
    baseDefense: 70,
    baseSpeed: 60,
    catchRate: 0.06,
    learnableSkills: [
      { skillId: "bubble-beam", unlockLevel: 1 },
      { skillId: "aqua-tail", unlockLevel: 1 },
      { skillId: "hydro-cannon", unlockLevel: 10 },
    ],
    image: "/monsters/abyssshark.svg",
  },

  // ============================== NATURE ==============================
  {
    id: 11,
    slug: "leafcat",
    name: "LeafCat",
    description:
      "A curious cat with leaves sprouting from its tail. It naps in sunbeams and purrs like rustling grass.",
    element: "nature",
    rarity: "common",
    baseHp: 60,
    baseAttack: 55,
    baseDefense: 50,
    baseSpeed: 45,
    catchRate: 0.55,
    learnableSkills: [
      { skillId: "leaf-slap", unlockLevel: 1 },
      { skillId: "vine-whip", unlockLevel: 1 },
      { skillId: "thorn-spike", unlockLevel: 9 },
    ],
    image: "/monsters/leafcat.svg",
  },
  {
    id: 12,
    slug: "bloommantis",
    name: "BloomMantis",
    description:
      "A mantis crowned with a blooming flower. Its scythes strike like falling petals — beautiful and sharp.",
    element: "nature",
    rarity: "common",
    baseHp: 50,
    baseAttack: 65,
    baseDefense: 45,
    baseSpeed: 60,
    catchRate: 0.5,
    learnableSkills: [
      { skillId: "leaf-slap", unlockLevel: 1 },
      { skillId: "thorn-spike", unlockLevel: 1 },
    ],
    image: "/monsters/bloommantis.svg",
  },
  {
    id: 13,
    slug: "mossbear",
    name: "MossBear",
    description:
      "A lumbering bear whose back is a small garden. It guards the forest and absorbs blows like tree bark.",
    element: "nature",
    rarity: "rare",
    baseHp: 80,
    baseAttack: 60,
    baseDefense: 70,
    baseSpeed: 30,
    catchRate: 0.3,
    learnableSkills: [
      { skillId: "leaf-slap", unlockLevel: 1 },
      { skillId: "vine-whip", unlockLevel: 1 },
      { skillId: "thorn-spike", unlockLevel: 1 },
      { skillId: "solar-blade", unlockLevel: 20 },
    ],
    image: "/monsters/mossbear.svg",
  },
  {
    id: 14,
    slug: "thorndeer",
    name: "ThornDeer",
    description:
      "A proud deer with antlers of living thorn. It walks silent paths through the deepest groves.",
    element: "nature",
    rarity: "epic",
    baseHp: 75,
    baseAttack: 75,
    baseDefense: 65,
    baseSpeed: 65,
    catchRate: 0.18,
    learnableSkills: [
      { skillId: "vine-whip", unlockLevel: 1 },
      { skillId: "thorn-spike", unlockLevel: 1 },
      { skillId: "solar-blade", unlockLevel: 1 },
    ],
    image: "/monsters/thorndeer.svg",
  },
  {
    id: 15,
    slug: "ancienttreant",
    name: "AncientTreant",
    description:
      "A tree spirit that has watched the forest for a thousand years. Its roots reach deeper than any dungeon.",
    element: "nature",
    rarity: "legendary",
    baseHp: 100,
    baseAttack: 70,
    baseDefense: 95,
    baseSpeed: 35,
    catchRate: 0.05,
    learnableSkills: [
      { skillId: "vine-whip", unlockLevel: 1 },
      { skillId: "thorn-spike", unlockLevel: 1 },
      { skillId: "solar-blade", unlockLevel: 1 },
    ],
    image: "/monsters/ancienttreant.svg",
  },

  // ============================== ELECTRIC ==============================
  {
    id: 16,
    slug: "sparkmouse",
    name: "SparkMouse",
    description:
      "A tiny mouse whose cheeks crackle with static. It darts between shadows faster than the eye can follow.",
    element: "electric",
    rarity: "common",
    baseHp: 45,
    baseAttack: 50,
    baseDefense: 40,
    baseSpeed: 75,
    catchRate: 0.55,
    learnableSkills: [
      { skillId: "spark", unlockLevel: 1 },
      { skillId: "shock-wave", unlockLevel: 1 },
      { skillId: "thunder-fang", unlockLevel: 10 },
    ],
    image: "/monsters/sparkmouse.svg",
  },
  {
    id: 17,
    slug: "staticlynx",
    name: "StaticLynx",
    description:
      "A sleek lynx whose fur stands on end with stored charge. It stalks high-voltage towers at night.",
    element: "electric",
    rarity: "common",
    baseHp: 50,
    baseAttack: 55,
    baseDefense: 45,
    baseSpeed: 70,
    catchRate: 0.5,
    learnableSkills: [
      { skillId: "spark", unlockLevel: 1 },
      { skillId: "shock-wave", unlockLevel: 1 },
    ],
    image: "/monsters/staticlynx.svg",
  },
  {
    id: 18,
    slug: "stormdragon",
    name: "StormDragon",
    description:
      "A drake born inside a thundercloud. Its roar sounds like rolling thunder and it rarely touches the ground.",
    element: "electric",
    rarity: "rare",
    baseHp: 70,
    baseAttack: 75,
    baseDefense: 55,
    baseSpeed: 70,
    catchRate: 0.28,
    learnableSkills: [
      { skillId: "shock-wave", unlockLevel: 1 },
      { skillId: "thunder-fang", unlockLevel: 1 },
      { skillId: "thunderbolt", unlockLevel: 1 },
    ],
    image: "/monsters/stormdragon.svg",
  },
  {
    id: 19,
    slug: "volthare",
    name: "VoltHare",
    description:
      "The fastest monster known on land. It outruns lightning itself — if only for a few seconds.",
    element: "electric",
    rarity: "rare",
    baseHp: 55,
    baseAttack: 60,
    baseDefense: 45,
    baseSpeed: 90,
    catchRate: 0.32,
    learnableSkills: [
      { skillId: "spark", unlockLevel: 1 },
      { skillId: "thunder-fang", unlockLevel: 1 },
      { skillId: "thunderbolt", unlockLevel: 16 },
    ],
    image: "/monsters/volthare.svg",
  },
  {
    id: 20,
    slug: "thunderbird",
    name: "ThunderBird",
    description:
      "A great bird whose wings crackle with storm energy. When it flies, the sky answers with lightning.",
    element: "electric",
    rarity: "epic",
    baseHp: 65,
    baseAttack: 85,
    baseDefense: 55,
    baseSpeed: 85,
    catchRate: 0.16,
    learnableSkills: [
      { skillId: "shock-wave", unlockLevel: 1 },
      { skillId: "thunder-fang", unlockLevel: 1 },
      { skillId: "thunderbolt", unlockLevel: 1 },
    ],
    image: "/monsters/thunderbird.svg",
  },

  // ====================== WEB3 SERIES (Pixel World Upgrade) ======================

  {
    id: 21,
    slug: "swapicorn",
    name: "Swapicorn",
    description:
      "An original purple-white unicorn that gallops between liquidity pools, two glowing token orbs orbiting its horn and a tail like a liquidity wave.",
    element: "electric",
    rarity: "rare",
    baseHp: 55,
    baseAttack: 75,
    baseDefense: 45,
    baseSpeed: 80,
    catchRate: 0.32,
    learnableSkills: [
      { skillId: "swap-dash", unlockLevel: 1 },
      { skillId: "liquidity-shield", unlockLevel: 1 },
      { skillId: "slippage-strike", unlockLevel: 8 },
      { skillId: "amm-burst", unlockLevel: 16 },
    ],
    image: "/monsters/swapicorn.svg",
  },
  {
    id: 22,
    slug: "oracleowl",
    name: "OracleOwl",
    description:
      "A dark-blue mechanical owl whose gold data feathers glint with price-feed light, its eyes reading values no on-chain code can see.",
    element: "nature",
    rarity: "rare",
    baseHp: 65,
    baseAttack: 60,
    baseDefense: 60,
    baseSpeed: 60,
    catchRate: 0.3,
    learnableSkills: [
      { skillId: "price-feed", unlockLevel: 1 },
      { skillId: "oracle-guard", unlockLevel: 1 },
      { skillId: "data-verify", unlockLevel: 10 },
      { skillId: "market-signal", unlockLevel: 18 },
    ],
    image: "/monsters/oracleowl.svg",
  },
  {
    id: 23,
    slug: "zkbat",
    name: "ZkBat",
    description:
      "A black-purple bat with cyan eyes that flickers in and out of existence, a glowing proof core beating where its heart should be.",
    element: "electric",
    rarity: "epic",
    baseHp: 60,
    baseAttack: 80,
    baseDefense: 50,
    baseSpeed: 90,
    catchRate: 0.18,
    learnableSkills: [
      { skillId: "zk-veil", unlockLevel: 1 },
      { skillId: "proof-pulse", unlockLevel: 1 },
      { skillId: "hidden-witness", unlockLevel: 10 },
      { skillId: "zero-burst", unlockLevel: 18 },
    ],
    image: "/monsters/zkbat.svg",
  },
  {
    id: 24,
    slug: "bridgefox",
    name: "BridgeFox",
    description:
      "An orange fox with two tails — one for Chain A, one for Chain B — and a portal shimmer whenever it steps between networks.",
    element: "fire",
    rarity: "rare",
    baseHp: 55,
    baseAttack: 70,
    baseDefense: 45,
    baseSpeed: 85,
    catchRate: 0.3,
    learnableSkills: [
      { skillId: "chain-hop", unlockLevel: 1 },
      { skillId: "portal-step", unlockLevel: 1 },
      { skillId: "relay-strike", unlockLevel: 10 },
      { skillId: "bridge-lock", unlockLevel: 18 },
    ],
    image: "/monsters/bridgefox.svg",
  },
  {
    id: 25,
    slug: "lendgeist",
    name: "Lendgeist",
    description:
      "A translucent blue ghost that drifts along the water edge, floating tokens orbiting a locked collateral core.",
    element: "water",
    rarity: "epic",
    baseHp: 70,
    baseAttack: 65,
    baseDefense: 70,
    baseSpeed: 55,
    catchRate: 0.18,
    learnableSkills: [
      { skillId: "collateral-lock", unlockLevel: 1 },
      { skillId: "interest-drain", unlockLevel: 1 },
      { skillId: "borrow-mist", unlockLevel: 10 },
      { skillId: "liquidation", unlockLevel: 18 },
    ],
    image: "/monsters/lendgeist.svg",
  },
  {
    id: 26,
    slug: "gasgoblin",
    name: "GasGoblin",
    description:
      "A small green goblin lugging an oversized gas backpack with a GWEI meter that spikes when it gets excited.",
    element: "fire",
    rarity: "common",
    baseHp: 50,
    baseAttack: 60,
    baseDefense: 40,
    baseSpeed: 55,
    catchRate: 0.5,
    learnableSkills: [
      { skillId: "gas-spike", unlockLevel: 1 },
      { skillId: "priority-rush", unlockLevel: 1 },
      { skillId: "congestion-cloud", unlockLevel: 8 },
      { skillId: "fee-burn", unlockLevel: 14 },
    ],
    image: "/monsters/gasgoblin.svg",
  },
  {
    id: 27,
    slug: "mevmantis",
    name: "MevMantis",
    description:
      "A mechanical mantis whose bladed forearms slice transaction order itself, waiting in the dark of the mempool.",
    element: "nature",
    rarity: "epic",
    baseHp: 60,
    baseAttack: 85,
    baseDefense: 50,
    baseSpeed: 75,
    catchRate: 0.16,
    learnableSkills: [
      { skillId: "front-run", unlockLevel: 1 },
      { skillId: "back-run", unlockLevel: 1 },
      { skillId: "sandwich-cut", unlockLevel: 10 },
      { skillId: "mev-extract", unlockLevel: 18 },
    ],
    image: "/monsters/mevmantis.svg",
  },
  {
    id: 28,
    slug: "vaultturtle",
    name: "VaultTurtle",
    description:
      "A large mechanical turtle whose vault-like shell bears a hardware-wallet display — cold, patient, and utterly self-custodial.",
    element: "water",
    rarity: "legendary",
    baseHp: 90,
    baseAttack: 70,
    baseDefense: 100,
    baseSpeed: 40,
    catchRate: 0.1,
    learnableSkills: [
      { skillId: "cold-guard", unlockLevel: 1 },
      { skillId: "hash-wall", unlockLevel: 1 },
      { skillId: "self-custody", unlockLevel: 12 },
      { skillId: "recovery-seed", unlockLevel: 20 },
    ],
    image: "/monsters/vaultturtle.svg",
  },
];

/** Starter choices (Phase 2): one Common starter per starter element. */
export const STARTER_SPECIES_SLUGS: readonly string[] = ["firecub", "aquaturtle", "leafcat"];

export function getSpeciesById(id: number): MonsterSpeciesData | undefined {
  return MONSTER_SPECIES.find((s) => s.id === id);
}

export function getSpeciesBySlug(slug: string): MonsterSpeciesData | undefined {
  return MONSTER_SPECIES.find((s) => s.slug === slug);
}

export function getSpeciesByElement(element: Element): readonly MonsterSpeciesData[] {
  return MONSTER_SPECIES.filter((s) => s.element === element);
}

export function getStarters(): readonly MonsterSpeciesData[] {
  return MONSTER_SPECIES.filter((s) => STARTER_SPECIES_SLUGS.includes(s.slug));
}

/**
 * On-chain evolution stage of a species: 0 = base form, then +1 per
 * evolution step back through the chain (FireCub 0 → FireWolf 1 →
 * InfernoWolf 2). Never derived from rarity.
 */
export function getEvolutionStage(species: MonsterSpeciesData): number {
  const evolvesFromId = species.evolution?.evolvesFrom;
  if (evolvesFromId === undefined) return 0;
  const from = getSpeciesById(evolvesFromId);
  if (!from) return 0;
  return getEvolutionStage(from) + 1;
}
