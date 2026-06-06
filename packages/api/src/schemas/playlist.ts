import { z } from "zod";

import { findEmbedProvider } from "@repo/config/embed-hosts";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-f]{24}$/, "Invalid ObjectId");

const slugSchema = z
  .string()
  .regex(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u, "Invalid slug")
  .min(1)
  .max(200);

// A third-party URL to embed on the playlist page instead of uploading audio to
// R2 — a SoundCloud resource or a page from an approved domain. Host-restricted
// to the shared embed allow-list (also drives CSP frame-src) so a stored value
// can never point an iframe at an arbitrary origin.
const embedUrlSchema = z
  .string()
  .url()
  .max(500)
  .refine(
    (value) => findEmbedProvider(value) !== null,
    "Domain not allowed for embedding",
  );

export const playlistStatusSchema = z.enum(["draft", "published"]);
export type PlaylistStatus = z.infer<typeof playlistStatusSchema>;

const localeContentSchema = z.object({
  title: z.string().min(1).max(200),
  slug: slugSchema,
  description: z.string().max(2000).optional(),
  scholarName: z.string().max(200).optional(),
});

export const playlistSchema = z.object({
  id: objectIdSchema,
  ar: localeContentSchema,
  en: localeContentSchema,
  coverMediaId: objectIdSchema.optional(),
  scholarImage: z.string().max(500).optional(),
  embedUrl: embedUrlSchema.optional(),
  status: playlistStatusSchema,
  categoryIds: z.array(objectIdSchema),
  order: z.number().int().nonnegative(),
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
    scholarName: z.string().max(200).optional(),
  }),
  en: z.object({
    title: z.string().min(1).max(200),
    slug: slugSchema.optional(),
    description: z.string().max(2000).optional(),
    scholarName: z.string().max(200).optional(),
  }),
  coverMediaId: objectIdSchema.optional(),
  scholarImage: z.string().max(500).optional(),
  embedUrl: embedUrlSchema.optional(),
  status: playlistStatusSchema.default("draft"),
  categoryIds: z.array(objectIdSchema).default([]),
  order: z.number().int().nonnegative().optional(),
});
export type PlaylistCreateInput = z.infer<typeof playlistCreateInputSchema>;

export const playlistUpdateInputSchema = z
  .object({
    ar: z
      .object({
        title: z.string().min(1).max(200),
        slug: slugSchema,
        description: z.string().max(2000),
        scholarName: z.string().max(200),
      })
      .partial(),
    en: z
      .object({
        title: z.string().min(1).max(200),
        slug: slugSchema,
        description: z.string().max(2000),
        scholarName: z.string().max(200),
      })
      .partial(),
    coverMediaId: objectIdSchema.nullable(),
    scholarImage: z.string().max(500).nullable(),
    embedUrl: embedUrlSchema.nullable(),
    status: playlistStatusSchema,
    categoryIds: z.array(objectIdSchema),
    order: z.number().int().nonnegative(),
  })
  .partial();
export type PlaylistUpdateInput = z.infer<typeof playlistUpdateInputSchema>;
