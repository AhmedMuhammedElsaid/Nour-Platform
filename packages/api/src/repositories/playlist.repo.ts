import type mongoose from "mongoose";

import { getDb } from "../db/client";
import { PlaylistModel, type PlaylistDoc } from "../db/models/playlist.model";
import type { PlaylistCreateInput, PlaylistUpdateInput } from "../schemas/playlist";

/*
 * Lean repository for the `playlists` collection. All methods return plain
 * JS objects (`.lean()`) — never Mongoose Documents. Services own the
 * `_id → id` DTO mapping and RBAC checks; this layer is query-only.
 */

export type PlaylistLean = PlaylistDoc & { _id: mongoose.Types.ObjectId };

export async function findPlaylistById(
  id: string,
): Promise<PlaylistLean | null> {
  await getDb();
  return PlaylistModel.findById(id).lean<PlaylistLean>();
}

export async function findPlaylistBySlug(
  slug: string,
): Promise<PlaylistLean | null> {
  await getDb();
  return PlaylistModel.findOne({ slug }).lean<PlaylistLean>();
}

export async function findPublishedPlaylists(): Promise<PlaylistLean[]> {
  await getDb();
  return PlaylistModel.find({ status: "published" })
    .sort({ updatedAt: -1 })
    .lean<PlaylistLean[]>();
}

export async function findAllPlaylists(): Promise<PlaylistLean[]> {
  await getDb();
  return PlaylistModel.find({}).sort({ updatedAt: -1 }).lean<PlaylistLean[]>();
}

export async function createPlaylist(
  data: PlaylistCreateInput & { slug: string },
): Promise<PlaylistLean> {
  await getDb();
  // `create()` returns a Mongoose Document; destructure immediately so the
  // Document does not escape this function (CLAUDE.md §4.2).
  const doc = await PlaylistModel.create(data);
  // Fetch lean immediately after create to return a consistent plain object.
  const lean = await PlaylistModel.findById(doc._id).lean<PlaylistLean>();
  // `lean` is never null here — we just created the document.
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
