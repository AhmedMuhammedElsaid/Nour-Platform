import { z } from "zod";

import { localeSchema } from "./locale";

/*
 * Category shape (per-locale documents — DATABASE.md §3). Each document is one
 * locale of a taxonomy node; `contentId` ties the AR and EN versions together.
 * Playlists reference a category by its `contentId`, so the link is
 * locale-agnostic. Slug uniqueness is enforced per (locale, slug) at the DB level.
 */

// ObjectId-as-string ref. Mongoose serializes _id to a 24-char hex string at
// the lean() boundary; we validate the same shape on input to keep the
// service layer Mongoose-free per ARCHITECTURE.md §2.
const objectIdSchema = z
  .string()
  .regex(/^[0-9a-f]{24}$/, "Invalid ObjectId");

// Unicode-aware slug (any-script letters/numbers, hyphen-separated) so Arabic
// names produce non-empty slugs — see ADR 0002.
const slugSchema = z
  .string()
  .regex(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u, "Invalid slug")
  .min(1)
  .max(200);

export const categorySchema = z.object({
  id: objectIdSchema,
  contentId: objectIdSchema,
  locale: localeSchema,
  name: z.string().min(1).max(100),
  slug: slugSchema,
  description: z.string().max(500).optional(),
  coverMediaId: objectIdSchema.optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Category = z.infer<typeof categorySchema>;

/*
 * Create-input: `id`/timestamps are produced by Mongo. `slug` is optional
 * (service derives from `name`). `locale` required; `contentId` optional
 * (omit for first locale, supply to add a translation).
 */
export const categoryCreateInputSchema = z.object({
  locale: localeSchema,
  contentId: objectIdSchema.optional(),
  name: z.string().min(1).max(100),
  slug: slugSchema.optional(),
  description: z.string().max(500).optional(),
  coverMediaId: objectIdSchema.optional(),
});
export type CategoryCreateInput = z.infer<typeof categoryCreateInputSchema>;

/*
 * Update-input: every field optional so callers can PATCH any subset.
 * `locale`/`contentId` are immutable.
 */
export const categoryUpdateInputSchema = z
  .object({
    name: z.string().min(1).max(100),
    slug: slugSchema,
    description: z.string().max(500),
    coverMediaId: objectIdSchema.nullable(),
  })
  .partial();
export type CategoryUpdateInput = z.infer<typeof categoryUpdateInputSchema>;
