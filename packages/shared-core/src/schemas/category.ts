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
  name: z.string().min(1).max(100),
  slug: slugSchema,
  description: z.string().max(500).optional(),
});

export const categorySchema = z.object({
  id: objectIdSchema,
  ar: localeContentSchema,
  en: localeContentSchema,
  coverMediaId: objectIdSchema.optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Category = z.infer<typeof categorySchema>;

export const categoryCreateInputSchema = z.object({
  ar: z.object({
    name: z.string().min(1).max(100),
    slug: slugSchema.optional(),
    description: z.string().max(500).optional(),
  }),
  en: z.object({
    name: z.string().min(1).max(100),
    slug: slugSchema.optional(),
    description: z.string().max(500).optional(),
  }),
  coverMediaId: objectIdSchema.optional(),
});
export type CategoryCreateInput = z.infer<typeof categoryCreateInputSchema>;

export const categoryUpdateInputSchema = z
  .object({
    ar: z
      .object({
        name: z.string().min(1).max(100),
        slug: slugSchema,
        description: z.string().max(500),
      })
      .partial(),
    en: z
      .object({
        name: z.string().min(1).max(100),
        slug: slugSchema,
        description: z.string().max(500),
      })
      .partial(),
    coverMediaId: objectIdSchema.nullable(),
  })
  .partial();
export type CategoryUpdateInput = z.infer<typeof categoryUpdateInputSchema>;
