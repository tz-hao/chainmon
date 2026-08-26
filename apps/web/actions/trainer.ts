"use server";

export interface CreateTrainerActionResult {
  error?: string;
}

export async function createTrainerAction(
  _formData: FormData,
): Promise<CreateTrainerActionResult> {
  return {
    error: "Wallet sign-in creates your personal trainer automatically.",
  };
}
