import { revalidateTag } from "next/cache";

import { env } from "@repo/config/env";

import { requireSession } from "../auth/require-session";
import { findMediaById } from "../repositories/media.repo";
import {
  appendTrackId,
  findPlaylistById,
  removeTrackId,
  updatePlaylistById,
} from "../repositories/playlist.repo";
import {
  createTrack as repoCreateTrack,
  deleteTrackById,
  findTrackById,
  findTracksByPlaylistId,
  updateTrackById,
  updateTrackOrder,
} from "../repositories/track.repo";
import { AppError } from "../errors";
import {
  trackCreateInputSchema,
  trackUpdateInputSchema,
  type Track,
  type TrackCreateInput,
  type TrackUpdateInput,
} from "../schemas/track";

export interface PlayableTrack extends Track {
  srcUrl: string | null;
}

/*
 * Track service — Wave 2.6. Owns track CRUD and playlist-trackIds
 * synchronisation. Public reads require no session; all mutations require
 * admin role via requireSession. revalidateTag is called on every mutation
 * that affects public cache entries.
 */

// Converts a lean Mongo doc to the public-facing Track DTO.
function toDto(doc: {
  _id: { toString(): string };
  title: string;
  slug: string;
  description?: string | null;
  mediaId: { toString(): string };
  playlistId: { toString(): string };
  order: number;
  durationSecs?: number | null;
  createdAt: Date;
  updatedAt: Date;
}): Track {
  return {
    id: doc._id.toString(),
    title: doc.title,
    slug: doc.slug,
    ...(doc.description != null ? { description: doc.description } : {}),
    mediaId: doc.mediaId.toString(),
    playlistId: doc.playlistId.toString(),
    order: doc.order,
    ...(doc.durationSecs != null ? { durationSecs: doc.durationSecs } : {}),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/*
 * Derives a URL-safe slug from a title. Mirrors the implementation in
 * playlist.service.ts and must stay in sync with slugSchema in schemas/track.ts.
 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 200);
}

// ---------------------------------------------------------------------------
// Public reads (no session required)
// ---------------------------------------------------------------------------

export async function getTracksByPlaylist(playlistId: string): Promise<Track[]> {
  const docs = await findTracksByPlaylistId(playlistId);
  return docs.map(toDto);
}

export async function getTracksWithUrls(
  playlistId: string,
): Promise<PlayableTrack[]> {
  const docs = await findTracksByPlaylistId(playlistId);
  const tracks = docs.map(toDto);

  const base = env.R2_PUBLIC_BASE;
  if (!base) return tracks.map((t) => ({ ...t, srcUrl: null }));

  const mediaDocs = await Promise.all(
    docs.map((doc) => findMediaById(doc.mediaId.toString())),
  );

  return tracks.map((t, i) => {
    const media = mediaDocs[i];
    return { ...t, srcUrl: media?.key ? `${base}/${media.key}` : null };
  });
}

export async function getTrackById(id: string): Promise<Track | null> {
  const doc = await findTrackById(id);
  return doc ? toDto(doc) : null;
}

// ---------------------------------------------------------------------------
// Admin mutations
// ---------------------------------------------------------------------------

export async function createTrack(input: TrackCreateInput): Promise<Track> {
  // Auth check first — no I/O before verifying identity.
  await requireSession(["admin"]);

  // Zod parse throws AppError.Validation on bad input (CLAUDE.md §4).
  const parsed = trackCreateInputSchema.parse(input);

  // Verify the parent playlist exists before creating the track.
  const playlist = await findPlaylistById(parsed.playlistId);
  if (!playlist) throw AppError.NotFound("Playlist");

  // Auto-generate slug from title when the caller omits it.
  const slug = parsed.slug ?? slugify(parsed.title);

  // Assign order at end of the current track list when the caller omits it.
  const order = parsed.order ?? playlist.trackIds.length;

  const lean = await repoCreateTrack({ ...parsed, slug, order });

  // Keep the parent playlist's trackIds in sync. $push appends at the end;
  // for callers that supply an explicit `order`, a subsequent reorderTracks
  // call should be used to position the track correctly.
  await appendTrackId(parsed.playlistId, lean._id.toString());

  revalidateTag(`playlist:${playlist.slug}`, "default");

  return toDto(lean);
}

export async function updateTrack(
  id: string,
  input: TrackUpdateInput,
): Promise<Track> {
  await requireSession(["admin"]);

  const parsed = trackUpdateInputSchema.parse(input);

  const lean = await updateTrackById(id, parsed);
  if (!lean) throw AppError.NotFound("Track");

  // Resolve the parent playlist to get its slug for cache invalidation.
  const playlist = await findPlaylistById(lean.playlistId.toString());
  if (playlist) {
    revalidateTag(`playlist:${playlist.slug}`, "default");
  }

  return toDto(lean);
}

export async function deleteTrack(id: string): Promise<void> {
  await requireSession(["admin"]);

  // Fetch before delete so we have playlistId + slug for side-effects.
  const existing = await findTrackById(id);
  if (!existing) throw AppError.NotFound("Track");

  const playlistId = existing.playlistId.toString();

  await deleteTrackById(id);

  // Remove this track from the parent playlist's ordered trackIds array.
  await removeTrackId(playlistId, id);

  // Resolve playlist slug for cache tag invalidation.
  const playlist = await findPlaylistById(playlistId);
  if (playlist) {
    revalidateTag(`playlist:${playlist.slug}`, "default");
  }
}

export async function reorderTracks(
  playlistId: string,
  orderedTrackIds: string[],
): Promise<void> {
  await requireSession(["admin"]);

  // Verify the parent playlist exists before reordering.
  const playlist = await findPlaylistById(playlistId);
  if (!playlist) throw AppError.NotFound("Playlist");

  // Write the new order values (0-based index) to each track document.
  await updateTrackOrder(orderedTrackIds);

  // Replace the playlist's trackIds array with the new order so that the
  // authoritative ordering lives in both the Track.order field and the
  // Playlist.trackIds array (DATABASE.md: "order is authoritative here").
  // updatePlaylistById accepts a full replacement of trackIds.
  await updatePlaylistById(playlistId, { trackIds: orderedTrackIds });

  revalidateTag(`playlist:${playlist.slug}`, "default");
}
