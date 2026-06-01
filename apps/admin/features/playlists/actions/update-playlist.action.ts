"use server";

import { AppError } from "@repo/api/errors";
import { updatePlaylist } from "@repo/api/services/playlist";

import { playlistFormSchema } from "../schemas/playlist-form.schema";
import type { PlaylistFormValues } from "../schemas/playlist-form.schema";

export type UpdatePlaylistResult = { error: string } | undefined;

export async function updatePlaylistAction(
  id: string,
  input: PlaylistFormValues,
): Promise<UpdatePlaylistResult> {
  const parsed = playlistFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  try {
    await updatePlaylist(id, {
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
      soundcloudUrl: parsed.data.soundcloudUrl || undefined,
      status: parsed.data.status,
      categoryIds: parsed.data.categoryIds,
    });
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
}
