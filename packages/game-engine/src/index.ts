/**
 * @chainmon/game-engine
 * Pure, framework-free core game logic — NEVER imported into React components
 * for business rules; UI only calls this module (or server-side code).
 *
 * Phase 2-5 (current):
 *  - random.ts            unified randomness (randomInt / randomFloat / randomChoice /
 *                         weightedRandom / randomId)
 *  - stats.ts             canonical stat formula: Base + DNA Bonus + DNA-scaled Level Growth
 *  - monster-generator.ts DNA generation + individual monster generation
 *  - encounter.ts         weighted region encounters (wild monsters at full HP)
 *  - capture.ts           capture formula + capture balls + attempt roll
 *  - elements.ts          element advantage chart (1.5x / 0.75x / 1.0x)
 *  - damage.ts            damage formula + accuracy + defend multiplier
 *  - battle.ts            3v3 turn-based battle state machine
 *  - battle-ai.ts         PvE AI (actions + team generation)
 *  - experience.ts        level curve (level × level × 100) + multi-level ups + cap 50
 *  - rewards.ts           battle EXP / gold / item drop tables
 *  - evolution.ts         evolution eligibility + evolved monster computation
 */

export * from "./random";
export * from "./stats";
export * from "./monster-generator";
export * from "./encounter";
export * from "./capture";
export * from "./elements";
export * from "./damage";
export * from "./battle";
export * from "./battle-ai";
export * from "./experience";
export * from "./rewards";
export * from "./evolution";

export const GAME_ENGINE_VERSION = "0.5.0";

export const GAME_ENGINE_STATUS = "progression" as const;
