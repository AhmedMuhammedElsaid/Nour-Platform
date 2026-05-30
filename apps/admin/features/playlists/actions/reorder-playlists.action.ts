"use server";

import { AppError } from "@repo/api/errors";
import { reorderPlaylists } from "@repo/api/services/playlist";

export type ReorderPlaylistsResult = { error: string } | undefined;

export async function reorderPlaylistsAction(
  orderedPlaylistIds: string[],
): Promise<ReorderPlaylistsResult> {
  try {
    await reorderPlaylists(orderedPlaylistIds);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
}
