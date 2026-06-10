import { env } from "@repo/config/env";

import { requireSession } from "../auth/require-session";
import { playlistTag } from "../cache/tags";
import { invalidate } from "../cache/invalidate";
import { findMediaById } from "../repositories/media.repo";
import { findPlaylistById } from "../repositories/playlist.repo";
import {
  createTrack as repoCreateTrack,
  deleteTrackById,
  findTrackById,
  findTracksByPlaylist,
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
import { slugify } from "../utils/slug";

export interface PlayableTrack extends Track {
  srcUrl: string | null;
}

// Converts a lean Mongo doc to the public-facing Track DTO.
function toDto(doc: {
  _id: { toString(): string };
  ar: { title: string; slug: string; description?: string | null };
  en: { title: string; slug: string; description?: string | null };
  mediaId: { toString(): string };
  playlistId: { toString(): string };
  order: number;
  durationSecs?: number | null;
  createdAt: Date;
  updatedAt: Date;
}): Track {
  return {
    id: doc._id.toString(),
    ar: {
      title: doc.ar.title,
      slug: doc.ar.slug,
      ...(doc.ar.description != null ? { description: doc.ar.description } : {}),
    },
    en: {
      title: doc.en.title,
      slug: doc.en.slug,
      ...(doc.en.description != null ? { description: doc.en.description } : {}),
    },
    mediaId: doc.mediaId.toString(),
    playlistId: doc.playlistId.toString(),
    order: doc.order,
    ...(doc.durationSecs != null ? { durationSecs: doc.durationSecs } : {}),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Public reads (no session required)
// ---------------------------------------------------------------------------

export async function getTracksByPlaylist(playlistId: string): Promise<Track[]> {
  const docs = await findTracksByPlaylist(playlistId);
  return docs.map(toDto);
}

export async function getTracksWithUrls(playlistId: string): Promise<PlayableTrack[]> {
  const docs = await findTracksByPlaylist(playlistId);
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
  await requireSession(["admin"]);

  const parsed = trackCreateInputSchema.parse(input);

  const playlist = await findPlaylistById(parsed.playlistId);
  if (!playlist) throw AppError.NotFound("Playlist");

  const arSlug = parsed.ar.slug ?? slugify(parsed.ar.title);
  const enSlug = parsed.en.slug ?? slugify(parsed.en.title);

  const existing = await findTracksByPlaylist(parsed.playlistId);
  const order = parsed.order ?? existing.length;

  const { ar, en, order: _omitOrder, ...rest } = parsed;
  const lean = await repoCreateTrack({
    ...rest,
    ar: { title: ar.title, slug: arSlug, ...(ar.description ? { description: ar.description } : {}) },
    en: { title: en.title, slug: enSlug, ...(en.description ? { description: en.description } : {}) },
    order,
  });

  await invalidate([playlistTag(parsed.playlistId)]);

  return toDto(lean);
}

export async function updateTrack(id: string, input: TrackUpdateInput): Promise<Track> {
  await requireSession(["admin"]);

  const parsed = trackUpdateInputSchema.parse(input);

  const lean = await updateTrackById(id, parsed);
  if (!lean) throw AppError.NotFound("Track");

  await invalidate([playlistTag(lean.playlistId.toString())]);

  return toDto(lean);
}

export async function deleteTrack(id: string): Promise<void> {
  await requireSession(["admin"]);

  const existing = await findTrackById(id);
  if (!existing) throw AppError.NotFound("Track");

  await deleteTrackById(id);

  await invalidate([playlistTag(existing.playlistId.toString())]);
}

export async function reorderTracks(
  playlistId: string,
  orderedTrackIds: string[],
): Promise<void> {
  await requireSession(["admin"]);

  const playlist = await findPlaylistById(playlistId);
  if (!playlist) throw AppError.NotFound("Playlist");

  await updateTrackOrder(orderedTrackIds);

  await invalidate([playlistTag(playlistId)]);
}
