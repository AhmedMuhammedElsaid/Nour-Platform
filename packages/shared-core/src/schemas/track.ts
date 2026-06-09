import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-f]{24}$/, "Invalid ObjectId");

const slugSchema = z
  .string()
  .regex(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u, "Invalid slug")
  .min(1)
  .max(200);

const localeContentSchema = z.object({
  title: z.string().min(1).max(200),
  slug: slugSchema,
  description: z.string().max(2000).optional(),
});

export const trackSchema = z.object({
  id: objectIdSchema,
  ar: localeContentSchema,
  en: localeContentSchema,
  mediaId: objectIdSchema,
  playlistId: objectIdSchema,
  order: z.number().int().nonnegative(),
  durationSecs: z.number().positive().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Track = z.infer<typeof trackSchema>;

export const trackCreateInputSchema = z.object({
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
  mediaId: objectIdSchema,
  playlistId: objectIdSchema,
  order: z.number().int().nonnegative().optional(),
  durationSecs: z.number().positive().optional(),
});
export type TrackCreateInput = z.infer<typeof trackCreateInputSchema>;

export const trackUpdateInputSchema = z
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
    mediaId: objectIdSchema,
    order: z.number().int().nonnegative(),
    durationSecs: z.number().positive(),
  })
  .partial();
export type TrackUpdateInput = z.infer<typeof trackUpdateInputSchema>;
