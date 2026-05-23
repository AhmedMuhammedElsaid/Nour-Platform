"use server";

import { redirect } from "next/navigation";

import { AppError } from "@repo/api/errors";
import { createPlaylist } from "@repo/api/services/playlist";

import {
  playlistFormSchema,
  type PlaylistFormValues,
} from "../schemas/playlist-form.schema";

export type { PlaylistFormValues } from "../schemas/playlist-form.schema";
export { playlistFormSchema } from "../schemas/playlist-form.schema";
export type CreatePlaylistResult = { error: string } | undefined;

export async function createPlaylistAction(
  input: PlaylistFormValues,
): Promise<CreatePlaylistResult> {
  const parsed = playlistFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  try {
    const playlist = await createPlaylist({
      title: parsed.data.title,
      description: parsed.data.description || undefined,
      status: parsed.data.status,
      trackIds: [],
    });
    redirect(`/playlists/${playlist.id}/edit`);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    // Re-throw Next.js redirect — it is the success path, not an error.
    throw error;
  }
}
