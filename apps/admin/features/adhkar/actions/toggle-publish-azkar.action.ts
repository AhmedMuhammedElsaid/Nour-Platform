"use server";

import { AppError } from "@repo/api/errors";
import { publishAzkar, unpublishAzkar } from "@repo/api/services/azkar";

export async function togglePublishAzkarAction(
  id: string,
  publish: boolean,
): Promise<{ error: string } | undefined> {
  try {
    await (publish ? publishAzkar(id) : unpublishAzkar(id));
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
}
