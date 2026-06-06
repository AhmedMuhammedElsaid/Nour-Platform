"use server";

import { AppError } from "@repo/api/errors";
import { reorderAzkar } from "@repo/api/services/azkar";

export async function reorderAzkarAction(
  orderedIds: string[],
): Promise<{ error: string } | undefined> {
  try {
    await reorderAzkar(orderedIds);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
}
