import { z } from "zod";

const objectIdSchema = z.string().regex(/^[0-9a-f]{24}$/, "Invalid ObjectId");

const slugSchema = z
  .string()
  .regex(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u, "Invalid slug")
  .min(1)
  .max(200);

export const azkarStatusSchema = z.enum(["draft", "published"]);
export type AzkarStatus = z.infer<typeof azkarStatusSchema>;

export const azkarKindSchema = z.enum(["morning", "evening", "other"]);
export type AzkarKind = z.infer<typeof azkarKindSchema>;

const localePairSchema = z.object({
  ar: z.string().max(2000).optional(),
  en: z.string().max(2000).optional(),
});

// A single remembrance: required Arabic text + repeat count, everything else
// optional. Embedded in an Azkar document's `items[]`.
export const dhikrItemSchema = z.object({
  ar: z.string().min(1).max(4000),
  en: z.string().max(4000).optional(),
  transliteration: z.string().max(4000).optional(),
  repeat: z.number().int().min(1).max(1000),
  virtue: localePairSchema.optional(),
  source: localePairSchema.optional(),
  audioMediaId: objectIdSchema.optional(),
});
export type DhikrItem = z.infer<typeof dhikrItemSchema>;

const localeTitleSchema = z.object({
  title: z.string().min(1).max(200),
  slug: slugSchema,
});

export const azkarSchema = z.object({
  id: objectIdSchema,
  kind: azkarKindSchema,
  status: azkarStatusSchema,
  order: z.number().int().nonnegative(),
  ar: localeTitleSchema,
  en: localeTitleSchema,
  items: z.array(dhikrItemSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Azkar = z.infer<typeof azkarSchema>;

export const azkarCreateInputSchema = z.object({
  kind: azkarKindSchema,
  ar: z.object({ title: z.string().min(1).max(200), slug: slugSchema.optional() }),
  en: z.object({ title: z.string().min(1).max(200), slug: slugSchema.optional() }),
  status: azkarStatusSchema.default("draft"),
  order: z.number().int().nonnegative().optional(),
  items: z.array(dhikrItemSchema).min(1, "At least one dhikr is required"),
});
export type AzkarCreateInput = z.infer<typeof azkarCreateInputSchema>;

export const azkarUpdateInputSchema = z
  .object({
    kind: azkarKindSchema,
    ar: z.object({ title: z.string().min(1).max(200), slug: slugSchema }).partial(),
    en: z.object({ title: z.string().min(1).max(200), slug: slugSchema }).partial(),
    status: azkarStatusSchema,
    order: z.number().int().nonnegative(),
    items: z.array(dhikrItemSchema),
  })
  .partial();
export type AzkarUpdateInput = z.infer<typeof azkarUpdateInputSchema>;
