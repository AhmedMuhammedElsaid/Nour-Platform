import { z } from "zod";

import { localeSchema } from "./locale";

/*
 * Playlist shape per DATABASE.md §3 (per-locale documents). Each playlist
 * document represents ONE locale of a logical program; its `contentId` ties
 * the AR and EN versions together. Track ordering lives on the Track document
 * (`order`) — playlists no longer carry a `trackIds` mirror (see localization.md).
 */

// ObjectId-as-string ref. Mongoose serializes _id to a 24-char hex string at
// the lean() boundary; we validate the same shape on input to keep the
// service layer Mongoose-free per ARCHITECTURE.md §2.
const objectIdSchema = z
  .string()
  .regex(/^[0-9a-f]{24}$/, "Invalid ObjectId");

// Slugs are URL path segments. Unicode letters/numbers (any script) are
// allowed so Arabic titles produce non-empty slugs — see ADR 0002. Latin
// slugs are still lowercased by the service's slugify(); the schema only
// validates the lexical shape (hyphen-separated letter/number runs).
const slugSchema = z
  .string()
  .regex(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u, "Invalid slug")
  .min(1)
  .max(200);

export const playlistStatusSchema = z.enum(["draft", "published"]);
export type PlaylistStatus = z.infer<typeof playlistStatusSchema>;

export const playlistSchema = z.object({
  id: objectIdSchema,
  // Shared across this playlist's locale variants; stable identity of the
  // logical program. categoryIds reference category contentIds (not _ids).
  contentId: objectIdSchema,
  locale: localeSchema,
  title: z.string().min(1).max(200),
  slug: slugSchema,
  description: z.string().max(2000).optional(),
  coverMediaId: objectIdSchema.optional(),
  status: playlistStatusSchema,
  categoryIds: z.array(objectIdSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Playlist = z.infer<typeof playlistSchema>;

/*
 * Create-input: `id`/timestamps are produced by Mongo. `slug` is optional
 * because the service derives it from `title` when omitted. `locale` is
 * required. `contentId` is optional: omit it to create the first locale of a
 * new program (the service mints one); supply it to add a translation that
 * links to an existing program. `categoryIds` hold category contentIds.
 */
export const playlistCreateInputSchema = z.object({
  locale: localeSchema,
  contentId: objectIdSchema.optional(),
  title: z.string().min(1).max(200),
  slug: slugSchema.optional(),
  description: z.string().max(2000).optional(),
  coverMediaId: objectIdSchema.optional(),
  status: playlistStatusSchema.default("draft"),
  categoryIds: z.array(objectIdSchema).default([]),
});
export type PlaylistCreateInput = z.infer<typeof playlistCreateInputSchema>;

/*
 * Update-input: every field optional so callers can PATCH any subset.
 * `locale` and `contentId` are immutable — not editable here.
 */
export const playlistUpdateInputSchema = z
  .object({
    title: z.string().min(1).max(200),
    slug: slugSchema,
    description: z.string().max(2000),
    coverMediaId: objectIdSchema.nullable(),
    status: playlistStatusSchema,
    categoryIds: z.array(objectIdSchema),
  })
  .partial();
export type PlaylistUpdateInput = z.infer<typeof playlistUpdateInputSchema>;
