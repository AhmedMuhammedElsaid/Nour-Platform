import { revalidateTag } from "next/cache";

import { env } from "@repo/config/env";

import { requireSession } from "../auth/require-session";
import { playlistTag } from "../cache/tags";
import { findMediaById } from "../repositories/media.repo";
import { findPlaylistsByContentId } from "../repositories/playlist.repo";
import {
  createTrack as repoCreateTrack,
  deleteTrackById,
  findTrackById,
  findTracksByPlaylist,
  updateTrackById,
  updateTrackOrder,
} from "../repositories/track.repo";
import { AppError } from "../errors";
import type { Locale } from "../schemas/locale";
import {
  trackCreateInputSchema,
  trackUpdateInputSchema,
  type Track,
  type TrackCreateInput,
  type TrackUpdateInput,
} from "../schemas/track";
import { slugify } from "../utils/slug";
import { newObjectIdString } from "../utils/id";

export interface PlayableTrack extends Track {
  srcUrl: string | null;
}

/*
 * Track service — owns track CRUD. Tracks are per-locale (DATABASE.md §3) and
 * belong to a logical playlist via `playlistContentId`. `Track.order` is the
 * sole source of ordering — playlists no longer mirror it. Public reads require
 * no session; all mutations require admin role via requireSession.
 */

// Resolves a logical playlist's locale variant, for slug-based cache tagging.
async function findPlaylistVariant(playlistContentId: string, locale: Locale) {
  const variants = await findPlaylistsByContentId(playlistContentId);
  return variants.find((p) => p.locale === locale) ?? null;
}

// Converts a lean Mongo doc to the public-facing Track DTO.
function toDto(doc: {
  _id: { toString(): string };
  contentId: { toString(): string };
  locale: string;
  title: string;
  slug: string;
  description?: string | null;
  mediaId: { toString(): string };
  playlistContentId: { toString(): string };
  order: number;
  durationSecs?: number | null;
  createdAt: Date;
  updatedAt: Date;
}): Track {
  return {
    id: doc._id.toString(),
    contentId: doc.contentId.toString(),
    locale: doc.locale as Track["locale"],
    title: doc.title,
    slug: doc.slug,
    ...(doc.description != null ? { description: doc.description } : {}),
    mediaId: doc.mediaId.toString(),
    playlistContentId: doc.playlistContentId.toString(),
    order: doc.order,
    ...(doc.durationSecs != null ? { durationSecs: doc.durationSecs } : {}),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Public reads (no session required) — locale-scoped
// ---------------------------------------------------------------------------

export async function getTracksByPlaylist(
  locale: Locale,
  playlistContentId: string,
): Promise<Track[]> {
  const docs = await findTracksByPlaylist(locale, playlistContentId);
  return docs.map(toDto);
}

export async function getTracksWithUrls(
  locale: Locale,
  playlistContentId: string,
): Promise<PlayableTrack[]> {
  const docs = await findTracksByPlaylist(locale, playlistContentId);
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

  // Verify the parent playlist exists in THIS locale before creating the track
  // (a track is per-locale; an EN track needs the EN playlist variant).
  const playlist = await findPlaylistVariant(
    parsed.playlistContentId,
    parsed.locale,
  );
  if (!playlist) throw AppError.NotFound("Playlist");

  // First locale of a new track mints a contentId; a translation supplies the
  // existing track's contentId.
  const contentId = parsed.contentId ?? newObjectIdString();

  // Auto-generate slug from title when the caller omits it.
  const slug = parsed.slug ?? slugify(parsed.title, contentId);

  // Assign order at the end of the current (locale) track list when omitted.
  const existing = await findTracksByPlaylist(
    parsed.locale,
    parsed.playlistContentId,
  );
  const order = parsed.order ?? existing.length;

  const {
    contentId: _omitContentId,
    slug: _omitSlug,
    order: _omitOrder,
    ...rest
  } = parsed;
  const lean = await repoCreateTrack({ ...rest, slug, order, contentId });

  revalidateTag(playlistTag(parsed.locale, playlist.slug), "default");

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

  const locale = lean.locale as Locale;
  const playlist = await findPlaylistVariant(
    lean.playlistContentId.toString(),
    locale,
  );
  if (playlist) {
    revalidateTag(playlistTag(locale, playlist.slug), "default");
  }

  return toDto(lean);
}

export async function deleteTrack(id: string): Promise<void> {
  await requireSession(["admin"]);

  // Fetch before delete so we have playlistContentId + locale for cache tags.
  const existing = await findTrackById(id);
  if (!existing) throw AppError.NotFound("Track");

  const locale = existing.locale as Locale;
  const playlistContentId = existing.playlistContentId.toString();

  await deleteTrackById(id);

  const playlist = await findPlaylistVariant(playlistContentId, locale);
  if (playlist) {
    revalidateTag(playlistTag(locale, playlist.slug), "default");
  }
}

export async function reorderTracks(
  locale: Locale,
  playlistContentId: string,
  orderedTrackIds: string[],
): Promise<void> {
  await requireSession(["admin"]);

  // Verify the parent playlist variant exists before reordering.
  const playlist = await findPlaylistVariant(playlistContentId, locale);
  if (!playlist) throw AppError.NotFound("Playlist");

  // Write the new order values (0-based index) to each track document.
  // Track.order is the sole source of ordering — nothing to mirror.
  await updateTrackOrder(orderedTrackIds);

  revalidateTag(playlistTag(locale, playlist.slug), "default");
}
