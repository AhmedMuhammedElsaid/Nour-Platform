"use server";

import { z } from "zod";

import { AppError } from "@repo/api/errors";
import { updatePlaylist } from "@repo/api/services/playlist";

import { playlistFormSchema } from "../schemas/playlist-form.schema";

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
      categoryIds: parsed.data.categoryIds,
    });
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
}
