"use server";

import { AppError } from "@repo/api/errors";
import { createTrack } from "@repo/api/services/track";

export type CreateTrackResult = { error: string } | { trackId: string };

// Derives a human-readable title from an audio filename.
function titleFromFilename(filename: string): string {
  return (
    filename
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ")
      .trim() || filename
  );
}

export async function createTrackAction(input: {
  filename: string;
  playlistContentId: string;
  locale: "ar" | "en";
  mediaId: string;
  durationSecs?: number;
}): Promise<CreateTrackResult> {
  try {
    const track = await createTrack({
      locale: input.locale,
      title: titleFromFilename(input.filename),
      playlistContentId: input.playlistContentId,
      mediaId: input.mediaId,
      ...(input.durationSecs != null
        ? { durationSecs: input.durationSecs }
        : {}),
    });
    return { trackId: track.id };
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
}
