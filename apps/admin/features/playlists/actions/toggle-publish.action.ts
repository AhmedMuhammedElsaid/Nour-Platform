"use server";

import { AppError } from "@repo/api/errors";
import { publishPlaylist, unpublishPlaylist } from "@repo/api/services/playlist";

export type TogglePublishResult = { error: string } | { status: "published" | "draft" };

export async function togglePublishAction(
  id: string,
  currentStatus: "draft" | "published",
): Promise<TogglePublishResult> {
  try {
    const playlist =
      currentStatus === "draft"
        ? await publishPlaylist(id)
        : await unpublishPlaylist(id);
    return { status: playlist.status };
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
}
