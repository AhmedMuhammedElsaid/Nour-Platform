import { z } from "zod";

/*
 * Track shape per DATABASE.md (Audio MVP). A track is a single audio item
 * inside exactly one Playlist; its `mediaId` points at the uploaded R2
 * object whose status must be `confirmed` before the track is playable.
 */

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-f]{24}$/, "Invalid ObjectId");

const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug")
  .min(1)
  .max(200);

export const trackSchema = z.object({
  id: objectIdSchema,
  title: z.string().min(1).max(200),
  // Uniqueness is enforced at the (playlistId, slug) compound index level
  // in Mongo. Zod only validates the lexical shape.
  slug: slugSchema,
  description: z.string().max(2000).optional(),
  mediaId: objectIdSchema,
  playlistId: objectIdSchema,
  // Non-negative integer so the natural-sort UI can collapse to a single
  // numeric comparator; reorder mutations renumber 0..N-1.
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
 * derived from `title` by the service when omitted. `durationSecs` is
 * optional: the admin uploader reads it client-side from the audio element's
 * metadata and passes it through. (A future media-analysis pipeline may
 * overwrite it server-side; until then this is the only source.)
 */
export const trackCreateInputSchema = z.object({
  title: z.string().min(1).max(200),
  slug: slugSchema.optional(),
  description: z.string().max(2000).optional(),
  mediaId: objectIdSchema,
  playlistId: objectIdSchema,
  order: z.number().int().nonnegative().optional(),
  durationSecs: z.number().positive().optional(),
});
export type TrackCreateInput = z.infer<typeof trackCreateInputSchema>;

/*
 * Update-input: every field optional. `playlistId` is omitted on purpose —
 * moving a track between playlists is a dedicated service action (it has
 * to also fix the source/target playlists' `trackIds`) and not a free-form
 * field edit.
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
