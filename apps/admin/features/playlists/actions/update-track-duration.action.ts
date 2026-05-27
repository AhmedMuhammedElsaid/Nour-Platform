"use server";

import { AppError } from "@repo/api/errors";
import { updateTrack } from "@repo/api/services/track";

export type UpdateTrackDurationResult = { error: string } | { ok: true };

/*
 * Persists a duration read client-side (HTMLAudioElement metadata) for a
 * track that predates client-side duration capture. Used by the backfill
 * control on the playlist edit page. RBAC + cache invalidation are enforced
 * inside updateTrack.
 */
export async function updateTrackDurationAction(input: {
  trackId: string;
  durationSecs: number;
}): Promise<UpdateTrackDurationResult> {
  try {
    await updateTrack(input.trackId, { durationSecs: input.durationSecs });
    return { ok: true };
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
}
