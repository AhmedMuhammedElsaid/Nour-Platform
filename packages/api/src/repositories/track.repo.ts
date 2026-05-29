import type mongoose from "mongoose";

import { getDb } from "../db/client";
import { TrackModel, type TrackDoc } from "../db/models/track.model";
import type { Locale } from "../schemas/locale";
import type { TrackCreateInput, TrackUpdateInput } from "../schemas/track";
import { flattenLocaleUpdate } from "../utils/mongo-update";

export type TrackLean = TrackDoc & { _id: mongoose.Types.ObjectId };

export async function findTrackById(id: string): Promise<TrackLean | null> {
  await getDb();
  return TrackModel.findById(id).lean<TrackLean>();
}

export async function findTracksByPlaylist(
  playlistId: string,
): Promise<TrackLean[]> {
  await getDb();
  return TrackModel.find({ playlistId })
    .sort({ order: 1 })
    .lean<TrackLean[]>();
}

export async function findTrackBySlug(
  locale: Locale,
  playlistId: string,
  slug: string,
): Promise<TrackLean | null> {
  await getDb();
  const field = locale === "ar" ? "ar.slug" : "en.slug";
  return TrackModel.findOne({ playlistId, [field]: slug }).lean<TrackLean>();
}

// Full-text search over tracks (requires the text index from migration 0006).
// Returns tracks regardless of playlist status; the service filters hits down
// to those with a published parent playlist.
export async function searchTracks(
  query: string,
  limit: number,
): Promise<TrackLean[]> {
  await getDb();
  return TrackModel.find(
    { $text: { $search: query } },
    { score: { $meta: "textScore" } },
  )
    .sort({ score: { $meta: "textScore" } })
    .limit(limit)
    .lean<TrackLean[]>();
}

export async function createTrack(
  data: Omit<TrackCreateInput, "ar" | "en" | "order"> & {
    ar: { title: string; slug: string; description?: string };
    en: { title: string; slug: string; description?: string };
    order: number;
  },
): Promise<TrackLean> {
  await getDb();
  const doc = await TrackModel.create(data);
  const lean = await TrackModel.findById(doc._id).lean<TrackLean>();
  return lean!;
}

export async function updateTrackById(
  id: string,
  update: TrackUpdateInput,
): Promise<TrackLean | null> {
  await getDb();
  return TrackModel.findByIdAndUpdate(
    id,
    { $set: flattenLocaleUpdate(update) },
    { new: true },
  ).lean<TrackLean>();
}

export async function deleteTrackById(id: string): Promise<boolean> {
  await getDb();
  const result = await TrackModel.deleteOne({ _id: id });
  return result.deletedCount === 1;
}

export async function updateTrackOrder(orderedIds: string[]): Promise<void> {
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
