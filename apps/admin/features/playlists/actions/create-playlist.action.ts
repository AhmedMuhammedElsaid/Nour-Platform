"use server";

import { redirect } from "next/navigation";

import { AppError } from "@repo/api/errors";
import { createPlaylist } from "@repo/api/services/playlist";

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
      ar: {
        title: parsed.data.ar.title,
        description: parsed.data.ar.description || undefined,
        scholarName: parsed.data.ar.scholarName || undefined,
      },
      en: {
        title: parsed.data.en.title,
        description: parsed.data.en.description || undefined,
        scholarName: parsed.data.en.scholarName || undefined,
      },
      scholarImage: parsed.data.scholarImage || undefined,
      status: parsed.data.status,
      categoryIds: parsed.data.categoryIds,
    });
    redirect(`/playlists/${playlist.id}/edit`);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
}
