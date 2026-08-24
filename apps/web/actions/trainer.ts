"use server";

import { redirect } from "next/navigation";
import { getRepository } from "@/lib/data";
import { createTrainerWithStarter } from "@/lib/data/demo-service";

export interface CreateTrainerActionResult {
  error?: string;
}

export async function createTrainerAction(
  formData: FormData,
): Promise<CreateTrainerActionResult> {
  const nickname = String(formData.get("nickname") ?? "");
  const starterSlug = String(formData.get("starter") ?? "");

  const repository = await getRepository();

  try {
    await createTrainerWithStarter(repository, nickname, starterSlug);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create trainer.",
    };
  }

  redirect("/monsters");
}
