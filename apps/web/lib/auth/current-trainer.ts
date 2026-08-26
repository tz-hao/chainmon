import "server-only";

import { getRepository, type GameRepository } from "@/lib/data";
import type { TrainerProfile } from "@chainmon/shared";
import { redirect } from "next/navigation";
import { requireAuthenticatedTrainer, TrainerSessionError } from "./trainer-session";

export async function getCurrentTrainer(): Promise<{
  repository: GameRepository;
  trainer: TrainerProfile;
}> {
  const repository = await getRepository();
  const trainerId = await requireAuthenticatedTrainer(repository);
  const trainer = await repository.getTrainerById(trainerId);
  if (!trainer) throw new TrainerSessionError("Your trainer account is unavailable.");
  return { repository, trainer };
}

/** Use in server-rendered pages: unauthenticated visitors return to wallet login. */
export async function requirePageTrainer() {
  try {
    return await getCurrentTrainer();
  } catch (error) {
    if (!(error instanceof TrainerSessionError)) throw error;
    redirect("/login");
  }
}
