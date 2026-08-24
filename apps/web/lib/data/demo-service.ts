import { generateMonster } from "@chainmon/game-engine";
import {
  getSpeciesBySlug,
  STARTER_SPECIES_SLUGS,
} from "@chainmon/monster-data";
import type { Monster, TrainerProfile } from "@chainmon/shared";
import type { GameRepository } from "./types";

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 20;

export function validateNickname(raw: string): string | null {
  const nickname = raw.trim();
  if (nickname.length < NICKNAME_MIN_LENGTH) {
    return `Nickname must be at least ${NICKNAME_MIN_LENGTH} characters.`;
  }
  if (nickname.length > NICKNAME_MAX_LENGTH) {
    return `Nickname must be at most ${NICKNAME_MAX_LENGTH} characters.`;
  }
  return null;
}

export function isStarterSlug(slug: string): boolean {
  return STARTER_SPECIES_SLUGS.includes(slug);
}

export interface CreateTrainerResult {
  trainer: TrainerProfile;
  monster: Monster;
}

/**
 * The Phase 2 onboarding chain:
 *   Create Trainer → Choose Starter → Generate Monster → Save Monster
 */
export async function createTrainerWithStarter(
  repository: GameRepository,
  nickname: string,
  starterSlug: string,
): Promise<CreateTrainerResult> {
  const nicknameError = validateNickname(nickname);
  if (nicknameError) {
    throw new Error(nicknameError);
  }

  const species = getSpeciesBySlug(starterSlug);
  if (!species || !isStarterSlug(starterSlug)) {
    throw new Error("Invalid starter monster.");
  }

  const trainer = await repository.createDemoTrainer(nickname.trim());
  const monster = generateMonster(species, { owner: trainer.id });
  await repository.addMonster(monster);
  return { trainer, monster };
}
