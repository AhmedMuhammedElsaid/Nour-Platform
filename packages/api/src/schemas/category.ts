import { z } from "zod";

/*
 * Category shape for P2-A Scholars + Categories phase. A category is a
 * top-level taxonomy node that groups playlists (and future resources).
 * Slug uniqueness is enforced at the DB level (unique index on CategoryModel).
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

export const categorySchema = z.object({
  id: objectIdSchema,
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
 * because the service derives it from `name` when omitted; supplying it
 * lets the admin override the auto-derived value.
 */
export const categoryCreateInputSchema = z.object({
  name: z.string().min(1).max(100),
  slug: slugSchema.optional(),
  description: z.string().max(500).optional(),
  coverMediaId: objectIdSchema.optional(),
});
export type CategoryCreateInput = z.infer<typeof categoryCreateInputSchema>;

/*
 * Update-input: every field optional so callers can PATCH any subset.
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
