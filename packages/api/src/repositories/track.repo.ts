import type mongoose from "mongoose";

import { getDb } from "../db/client";
import { TrackModel, type TrackDoc } from "../db/models/track.model";
import type { Locale } from "../schemas/locale";
import type { TrackCreateInput, TrackUpdateInput } from "../schemas/track";

/*
 * Lean repository for the `tracks` collection. All methods return plain
 * JS objects (`.lean()`) — never Mongoose Documents. Services own the
 * `_id → id` DTO mapping and RBAC checks; this layer is query-only.
 *
 * Tracks are per-locale (DATABASE.md §3): a track belongs to a logical playlist
 * via `playlistContentId` and carries its own `locale`. `order` is the sole
 * source of ordering (playlists no longer mirror it).
 */

export type TrackLean = TrackDoc & { _id: mongoose.Types.ObjectId };

export async function findTrackById(id: string): Promise<TrackLean | null> {
  await getDb();
  return TrackModel.findById(id).lean<TrackLean>();
}

export async function findTracksByPlaylist(
  locale: Locale,
  playlistContentId: string,
): Promise<TrackLean[]> {
  await getDb();
  // Ascending `order` keeps the player queue in the display sequence.
  return TrackModel.find({ playlistContentId, locale })
    .sort({ order: 1 })
    .lean<TrackLean[]>();
}

export async function findTrackBySlug(
  locale: Locale,
  playlistContentId: string,
  slug: string,
): Promise<TrackLean | null> {
  await getDb();
  return TrackModel.findOne({ playlistContentId, locale, slug }).lean<TrackLean>();
}

export async function createTrack(
  data: Omit<TrackCreateInput, "contentId" | "slug" | "order"> & {
    slug: string;
    order: number;
    contentId: string;
  },
): Promise<TrackLean> {
  await getDb();
  const doc = await TrackModel.create(data);
  // Fetch lean immediately after create — Document must not escape (CLAUDE.md §4.2).
  const lean = await TrackModel.findById(doc._id).lean<TrackLean>();
  return lean!;
}

export async function updateTrackById(
  id: string,
  update: TrackUpdateInput,
): Promise<TrackLean | null> {
  await getDb();
  return TrackModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean<TrackLean>();
}

export async function deleteTrackById(id: string): Promise<boolean> {
  await getDb();
  const result = await TrackModel.deleteOne({ _id: id });
  return result.deletedCount === 1;
}

/*
 * Reorder assigns a new `order` value to each track in a playlist.
 * Callers pass an ordered list of track IDs; this function writes the
 * index position (0-based) as the new `order`. Uses bulkWrite so the
 * entire operation is a single round-trip to Mongo.
 */
export async function updateTrackOrder(
  orderedIds: string[],
): Promise<void> {
  await getDb();
  const ops = orderedIds.map((id, index) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { order: index } },
    },
  }));
  if (ops.length > 0) {
    await TrackModel.bulkWrite(ops);
  }
}
