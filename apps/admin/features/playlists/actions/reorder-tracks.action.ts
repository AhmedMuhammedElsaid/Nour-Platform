"use server";

import { AppError } from "@repo/api/errors";
import { reorderTracks } from "@repo/api/services/track";

export type ReorderTracksResult = { error: string } | undefined;

export async function reorderTracksAction(
  locale: "ar" | "en",
  playlistContentId: string,
  orderedTrackIds: string[],
): Promise<ReorderTracksResult> {
  try {
    await reorderTracks(locale, playlistContentId, orderedTrackIds);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
}
