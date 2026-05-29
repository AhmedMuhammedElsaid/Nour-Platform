import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-f]{24}$/, "Invalid ObjectId");

const slugSchema = z
  .string()
  .regex(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u, "Invalid slug")
  .min(1)
  .max(200);

export const playlistStatusSchema = z.enum(["draft", "published"]);
export type PlaylistStatus = z.infer<typeof playlistStatusSchema>;

const localeContentSchema = z.object({
  title: z.string().min(1).max(200),
  slug: slugSchema,
  description: z.string().max(2000).optional(),
});

export const playlistSchema = z.object({
  id: objectIdSchema,
  ar: localeContentSchema,
  en: localeContentSchema,
  coverMediaId: objectIdSchema.optional(),
  status: playlistStatusSchema,
  categoryIds: z.array(objectIdSchema),
  // Present on list responses (getPublishedPlaylists / getAllPlaylists).
  // Absent on single-document lookups (getPlaylistBySlug / getPlaylistById).
  trackCount: z.number().int().nonnegative().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Playlist = z.infer<typeof playlistSchema>;

export const playlistCreateInputSchema = z.object({
  ar: z.object({
    title: z.string().min(1).max(200),
    slug: slugSchema.optional(),
    description: z.string().max(2000).optional(),
  }),
  en: z.object({
    title: z.string().min(1).max(200),
    slug: slugSchema.optional(),
    description: z.string().max(2000).optional(),
  }),
  coverMediaId: objectIdSchema.optional(),
  status: playlistStatusSchema.default("draft"),
  categoryIds: z.array(objectIdSchema).default([]),
});
export type PlaylistCreateInput = z.infer<typeof playlistCreateInputSchema>;

export const playlistUpdateInputSchema = z
  .object({
    ar: z
      .object({
        title: z.string().min(1).max(200),
        slug: slugSchema,
        description: z.string().max(2000),
      })
      .partial(),
    en: z
      .object({
        title: z.string().min(1).max(200),
        slug: slugSchema,
        description: z.string().max(2000),
      })
      .partial(),
    coverMediaId: objectIdSchema.nullable(),
    status: playlistStatusSchema,
    categoryIds: z.array(objectIdSchema),
  })
  .partial();
export type PlaylistUpdateInput = z.infer<typeof playlistUpdateInputSchema>;
