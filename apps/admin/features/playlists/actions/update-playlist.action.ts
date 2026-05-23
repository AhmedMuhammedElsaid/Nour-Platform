"use server";

import { z } from "zod";

import { AppError } from "@repo/api/errors";
import { updatePlaylist } from "@repo/api/services/playlist";

import { playlistFormSchema } from "./create-playlist.action";

export type UpdatePlaylistResult = { error: string } | undefined;

export async function updatePlaylistAction(
  id: string,
  input: z.infer<typeof playlistFormSchema>,
): Promise<UpdatePlaylistResult> {
  const parsed = playlistFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  try {
    await updatePlaylist(id, {
      title: parsed.data.title,
      description: parsed.data.description || undefined,
      status: parsed.data.status,
    });
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
}
