import type mongoose from "mongoose";

import { getDb } from "../db/client";
import { PlaylistModel, type PlaylistDoc } from "../db/models/playlist.model";
import type { Locale } from "../schemas/locale";
import type { PlaylistCreateInput, PlaylistUpdateInput } from "../schemas/playlist";

/*
 * Lean repository for the `playlists` collection. All methods return plain
 * JS objects (`.lean()`) — never Mongoose Documents. Services own the
 * `_id → id` DTO mapping and RBAC checks; this layer is query-only.
 *
 * Public reads are locale-scoped (DATABASE.md §3). Track ordering lives on the
 * Track document, so there are no more trackIds mutators here.
 */

export type PlaylistLean = PlaylistDoc & { _id: mongoose.Types.ObjectId };

export async function findPlaylistById(
  id: string,
): Promise<PlaylistLean | null> {
  await getDb();
  return PlaylistModel.findById(id).lean<PlaylistLean>();
}

export async function findPlaylistBySlug(
  locale: Locale,
  slug: string,
): Promise<PlaylistLean | null> {
  await getDb();
  return PlaylistModel.findOne({ locale, slug }).lean<PlaylistLean>();
}

/** All locale variants of a logical playlist, keyed by its shared contentId. */
export async function findPlaylistsByContentId(
  contentId: string,
): Promise<PlaylistLean[]> {
  await getDb();
  return PlaylistModel.find({ contentId }).lean<PlaylistLean[]>();
}

export async function findPublishedPlaylists(
  locale: Locale,
  filter?: { categoryContentId?: string },
): Promise<PlaylistLean[]> {
  await getDb();
  const query: Record<string, unknown> = { status: "published", locale };
  // categoryIds holds category contentIds; a scalar equality matches any
  // playlist whose array contains the given contentId.
  if (filter?.categoryContentId != null) {
    query["categoryIds"] = filter.categoryContentId;
  }
  return PlaylistModel.find(query)
    .sort({ updatedAt: -1 })
    .lean<PlaylistLean[]>();
}

export async function findAllPlaylists(): Promise<PlaylistLean[]> {
  await getDb();
  return PlaylistModel.find({}).sort({ updatedAt: -1 }).lean<PlaylistLean[]>();
}

export async function createPlaylist(
  data: Omit<PlaylistCreateInput, "contentId" | "slug"> & {
    slug: string;
    contentId: string;
  },
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
