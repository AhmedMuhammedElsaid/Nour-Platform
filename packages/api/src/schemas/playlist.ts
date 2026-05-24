import { z } from "zod";

/*
 * Playlist shape per DATABASE.md (Audio MVP). A playlist is the top-level
 * container the public web surfaces; tracks belong to exactly one playlist
 * and inherit its publish status for the MVP.
 */

// ObjectId-as-string ref. Mongoose serializes _id to a 24-char hex string at
// the lean() boundary; we validate the same shape on input to keep the
// service layer Mongoose-free per ARCHITECTURE.md §2.
const objectIdSchema = z
  .string()
  .regex(/^[0-9a-f]{24}$/, "Invalid ObjectId");

// Slugs are URL path segments, normalized to lowercase with single hyphen
// separators. Matches the slugify() output used by the service layer.
const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug")
  .min(1)
  .max(200);

export const playlistStatusSchema = z.enum(["draft", "published"]);
export type PlaylistStatus = z.infer<typeof playlistStatusSchema>;

export const playlistSchema = z.object({
  id: objectIdSchema,
  title: z.string().min(1).max(200),
  slug: slugSchema,
  description: z.string().max(2000).optional(),
  coverMediaId: objectIdSchema.optional(),
  status: playlistStatusSchema,
  trackIds: z.array(objectIdSchema),
  categoryIds: z.array(objectIdSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Playlist = z.infer<typeof playlistSchema>;

/*
 * Create-input: `id`/timestamps are produced by Mongo. `slug` is optional
 * because the service derives it from `title` when omitted; supplying it
 * lets the admin override the auto-derived value. `trackIds` defaults to
 * `[]` so the admin can create an empty playlist and add tracks later.
 */
export const playlistCreateInputSchema = z.object({
  title: z.string().min(1).max(200),
  slug: slugSchema.optional(),
  description: z.string().max(2000).optional(),
  coverMediaId: objectIdSchema.optional(),
  status: playlistStatusSchema.default("draft"),
  trackIds: z.array(objectIdSchema).default([]),
  categoryIds: z.array(objectIdSchema).default([]),
});
export type PlaylistCreateInput = z.infer<typeof playlistCreateInputSchema>;

/*
 * Update-input: every field optional so callers can PATCH any subset.
 * `trackIds` is intentionally settable here so the admin reorder UI can
 * replace the whole ordered list in a single mutation.
 */
export const playlistUpdateInputSchema = z
  .object({
    title: z.string().min(1).max(200),
    slug: slugSchema,
    description: z.string().max(2000),
    coverMediaId: objectIdSchema.nullable(),
    status: playlistStatusSchema,
    trackIds: z.array(objectIdSchema),
    categoryIds: z.array(objectIdSchema),
  })
  .partial();
export type PlaylistUpdateInput = z.infer<typeof playlistUpdateInputSchema>;
