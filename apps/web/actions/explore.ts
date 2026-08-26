"use server";

import { redirect } from "next/navigation";

export interface ExploreActionResult {
  error?: string;
}

export async function exploreAction(
  _formData: FormData,
): Promise<ExploreActionResult> {
  redirect("/world/select");
}
