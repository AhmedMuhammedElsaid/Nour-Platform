import { z } from "zod";

import { localeSchema } from "./locale";

/*
 * Track shape (per-locale documents — DATABASE.md §3). A track is a single
 * audio item belonging to one logical playlist (via `playlistContentId`, so a
 * track's AR/EN variants both attach to the same program). `mediaId` points at
 * the shared R2 object — audio is NOT re-uploaded per locale; only title/
 * description/slug are translated. `contentId` ties the track's locales together.
 */

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-f]{24}$/, "Invalid ObjectId");

// Unicode-aware slug — see ADR 0002.
const slugSchema = z
  .string()
  .regex(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u, "Invalid slug")
  .min(1)
  .max(200);

export const trackSchema = z.object({
  id: objectIdSchema,
  contentId: objectIdSchema,
  locale: localeSchema,
  title: z.string().min(1).max(200),
  // Uniqueness is enforced at the (playlistContentId, locale, slug) compound
  // index level in Mongo. Zod only validates the lexical shape.
  slug: slugSchema,
  description: z.string().max(2000).optional(),
  mediaId: objectIdSchema,
  // The logical playlist this track belongs to (a playlist contentId).
  playlistContentId: objectIdSchema,
  // Non-negative integer so the natural-sort UI can collapse to a single
  // numeric comparator; reorder mutations renumber 0..N-1. `order` is the
  // sole source of track ordering (playlists no longer mirror it in trackIds).
  order: z.number().int().nonnegative(),
  // Hydrated by the audio-analysis worker after the underlying Media
  // transitions to `confirmed`. Stored as seconds (float) to match the
  // HTMLMediaElement.duration contract.
  durationSecs: z.number().positive().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Track = z.infer<typeof trackSchema>;

/*
 * Create-input: timestamps and id come from Mongo. `slug` is optional and
 * derived from `title` by the service when omitted. `locale` is required;
 * `contentId` is optional (omit for first locale, supply to add a translation).
 * `durationSecs` is optional: the admin uploader reads it client-side from the
 * audio element's metadata and passes it through.
 */
export const trackCreateInputSchema = z.object({
  locale: localeSchema,
  contentId: objectIdSchema.optional(),
  title: z.string().min(1).max(200),
  slug: slugSchema.optional(),
  description: z.string().max(2000).optional(),
  mediaId: objectIdSchema,
  playlistContentId: objectIdSchema,
  order: z.number().int().nonnegative().optional(),
  durationSecs: z.number().positive().optional(),
});
export type TrackCreateInput = z.infer<typeof trackCreateInputSchema>;

/*
 * Update-input: every field optional. `playlistContentId`/`locale`/`contentId`
 * are omitted on purpose — moving a track between playlists is a dedicated
 * service action, and locale identity is immutable.
 */
export const trackUpdateInputSchema = z
  .object({
    title: z.string().min(1).max(200),
    slug: slugSchema,
    description: z.string().max(2000),
    mediaId: objectIdSchema,
    order: z.number().int().nonnegative(),
    durationSecs: z.number().positive(),
  })
  .partial();
export type TrackUpdateInput = z.infer<typeof trackUpdateInputSchema>;
