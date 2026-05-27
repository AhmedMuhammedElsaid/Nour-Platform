import type mongoose from "mongoose";

import { getDb } from "../db/client";
import { PlaylistModel, type PlaylistDoc } from "../db/models/playlist.model";
import type { Locale } from "../schemas/locale";
import type { PlaylistCreateInput, PlaylistUpdateInput } from "../schemas/playlist";

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
  return PlaylistModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean<PlaylistLean>();
}

export async function deletePlaylistById(id: string): Promise<boolean> {
  await getDb();
  const result = await PlaylistModel.deleteOne({ _id: id });
  return result.deletedCount === 1;
}
