import type mongoose from "mongoose";

import { getDb } from "../db/client";
import { PlaylistModel, type PlaylistDoc } from "../db/models/playlist.model";
import type { Locale } from "../schemas/locale";
import type { PlaylistCreateInput, PlaylistUpdateInput } from "../schemas/playlist";
import { flattenLocaleUpdate } from "../utils/mongo-update";

export type PlaylistLean = PlaylistDoc & { _id: mongoose.Types.ObjectId };

export async function findPlaylistById(id: string): Promise<PlaylistLean | null> {
  await getDb();
  return PlaylistModel.findById(id).lean<PlaylistLean>();
}

export async function findPlaylistBySlug(
  locale: Locale,
  slug: string,
): Promise<PlaylistLean | null> {
  await getDb();
  const field = locale === "ar" ? "ar.slug" : "en.slug";
  return PlaylistModel.findOne({ [field]: slug }).lean<PlaylistLean>();
}

export async function findPublishedPlaylists(
  filter?: { categoryId?: string },
): Promise<PlaylistLean[]> {
  await getDb();
  const query: Record<string, unknown> = { status: "published" };
  if (filter?.categoryId != null) {
    query["categoryIds"] = filter.categoryId;
  }
  return PlaylistModel.find(query).sort({ updatedAt: -1 }).lean<PlaylistLean[]>();
}

export async function findAllPlaylists(): Promise<PlaylistLean[]> {
  await getDb();
  return PlaylistModel.find({}).sort({ updatedAt: -1 }).lean<PlaylistLean[]>();
}

// Full-text search over published playlists (requires the text index from
// migration 0006). Sorted by relevance score, capped at `limit`.
export async function searchPublishedPlaylists(
  query: string,
  limit: number,
): Promise<PlaylistLean[]> {
  await getDb();
  return PlaylistModel.find(
    { $text: { $search: query }, status: "published" },
    { score: { $meta: "textScore" } },
  )
    .sort({ score: { $meta: "textScore" } })
    .limit(limit)
    .lean<PlaylistLean[]>();
}

// Batch-fetch published playlists by id — used to resolve track search hits to
// their (still-published) parent playlist.
export async function findPublishedPlaylistsByIds(
  ids: string[],
): Promise<PlaylistLean[]> {
  if (ids.length === 0) return [];
  await getDb();
  return PlaylistModel.find({
    _id: { $in: ids },
    status: "published",
  }).lean<PlaylistLean[]>();
}

export async function createPlaylist(
  data: Omit<PlaylistCreateInput, "ar" | "en"> & {
    ar: { title: string; slug: string; description?: string };
    en: { title: string; slug: string; description?: string };
  },
): Promise<PlaylistLean> {
  await getDb();
  const doc = await PlaylistModel.create(data);
  const lean = await PlaylistModel.findById(doc._id).lean<PlaylistLean>();
  return lean!;
}

export async function updatePlaylistById(
  id: string,
  update: PlaylistUpdateInput,
): Promise<PlaylistLean | null> {
  await getDb();
  return PlaylistModel.findByIdAndUpdate(
    id,
    { $set: flattenLocaleUpdate(update) },
    { new: true },
  ).lean<PlaylistLean>();
}

export async function deletePlaylistById(id: string): Promise<boolean> {
  await getDb();
  const result = await PlaylistModel.deleteOne({ _id: id });
  return result.deletedCount === 1;
}
