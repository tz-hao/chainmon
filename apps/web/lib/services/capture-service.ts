import {
  attemptCapture,
  generateMonster,
  getCaptureBall,
} from "@chainmon/game-engine";
import { getSpeciesById } from "@chainmon/monster-data";
import type { Monster } from "@chainmon/shared";
import type { GameRepository } from "@/lib/data";

export class CaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaptureError";
  }
}

export type ThrowBallOutcome =
  | { outcome: "captured"; monster: Monster; chance: number; roll: number }
  | { outcome: "failed"; chance: number; roll: number };

export interface ThrowBallParams {
  trainerId: string;
  encounterId: string;
  ballSlug: string;
}

/**
 * Throw Ball chain (server side only — clients may never submit species,
 * rarity, catchRate, DNA or stats):
 *
 *  load encounter → validate ACTIVE/ownership → resolve ball & species →
 *  validate inventory → capture engine roll → consume ball →
 *  on success: generateMonster + atomic commit (ball / monster / status)
 */
export async function throwBall(
  repository: GameRepository,
  params: ThrowBallParams,
): Promise<ThrowBallOutcome> {
  const { trainerId, encounterId, ballSlug } = params;

  const encounter = await repository.getEncounterById(encounterId);
  if (!encounter) {
    throw new CaptureError("Encounter not found.");
  }
  if (encounter.trainerId !== trainerId) {
    throw new CaptureError("This encounter does not belong to you.");
  }
  if (encounter.status === "captured") {
    throw new CaptureError("This monster was already captured.");
  }
  if (encounter.status === "fled") {
    throw new CaptureError("This monster already fled.");
  }

  const ball = getCaptureBall(ballSlug);
  if (!ball) {
    throw new CaptureError("Unknown capture ball.");
  }

  const species = getSpeciesById(encounter.speciesId);
  if (!species) {
    throw new CaptureError("Unknown monster species.");
  }

  const inventory = await repository.getInventory(trainerId);
  const entry = inventory.find((i) => i.slug === ballSlug);
  if (!entry || entry.quantity <= 0) {
    throw new CaptureError("You don't have any of that ball left.");
  }

  const attempt = attemptCapture({
    catchRate: species.catchRate,
    currentHp: encounter.currentHp,
    maxHp: encounter.maxHp,
    ballModifier: ball.modifier,
  });

  if (!attempt.success) {
    const consumed = await repository.consumeItem(trainerId, ballSlug);
    if (!consumed) {
      throw new CaptureError("You don't have any of that ball left.");
    }
    return { outcome: "failed", chance: attempt.chance, roll: attempt.roll };
  }

  const monster = generateMonster(species, { owner: trainerId });
  const result = await repository.commitCapture({
    encounterId,
    trainerId,
    itemSlug: ballSlug,
    monster,
  });
  if (result === "encounter-invalid") {
    throw new CaptureError("This monster was already captured.");
  }
  if (result === "no-ball") {
    throw new CaptureError("You don't have any of that ball left.");
  }

  return {
    outcome: "captured",
    monster,
    chance: attempt.chance,
    roll: attempt.roll,
  };
}

export async function fleeEncounter(
  repository: GameRepository,
  trainerId: string,
  encounterId: string,
): Promise<void> {
  const encounter = await repository.getEncounterById(encounterId);
  if (!encounter) {
    throw new CaptureError("Encounter not found.");
  }
  if (encounter.trainerId !== trainerId) {
    throw new CaptureError("This encounter does not belong to you.");
  }
  if (encounter.status === "fled") {
    return;
  }
  await repository.markEncounterFled(encounterId);
}
