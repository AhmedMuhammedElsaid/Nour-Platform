"use server";

import { redirect } from "next/navigation";

import { AppError } from "@repo/api/errors";
import { createPlaylist } from "@repo/api/services/playlist";

// Next 16 / Turbopack rejects non-action re-exports from "use server" files.
// Importers must pull `playlistFormSchema` / `PlaylistFormValues` directly
// from `../schemas/playlist-form.schema`. The type below stays inline because
// it's specific to this action's return shape.
import {
  playlistFormSchema,
  type PlaylistFormValues,
} from "../schemas/playlist-form.schema";

type CreatePlaylistResult = { error: string } | undefined;

export async function createPlaylistAction(
  input: PlaylistFormValues,
): Promise<CreatePlaylistResult> {
  const parsed = playlistFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  try {
    const playlist = await createPlaylist({
      locale: parsed.data.locale,
      // Empty string means "first locale of a new program" — let the service
      // mint the contentId. A non-empty value links a translation.
      ...(parsed.data.contentId ? { contentId: parsed.data.contentId } : {}),
      title: parsed.data.title,
      description: parsed.data.description || undefined,
      status: parsed.data.status,
      categoryIds: parsed.data.categoryIds,
    });
    redirect(`/playlists/${playlist.id}/edit`);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    // Re-throw Next.js redirect — it is the success path, not an error.
    throw error;
  }
}
