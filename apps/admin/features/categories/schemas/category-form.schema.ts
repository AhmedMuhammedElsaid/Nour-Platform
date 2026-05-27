import { z } from "zod";

export const categoryFormSchema = z.object({
  // The locale this document represents (immutable after create); carried
  // through for the "create translation" flow.
  locale: z.enum(["ar", "en"]),
  // Shared identity across locale variants. Empty string mints a new program;
  // set to link a translation. Converted to undefined at the action boundary.
  contentId: z.string(),
  name: z.string().min(1, "Name is required.").max(100, "Name is too long."),
  // Slug is validated against the same Unicode pattern as the DB schema
  // (ADR 0002 — Arabic letters allowed). Empty string is converted to
  // undefined at the action boundary when the service auto-derives the slug.
  slug: z
    .string()
    .min(1, "Slug is required.")
    .max(200, "Slug is too long.")
    .regex(
      /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u,
      "Slug must be letters/numbers separated by hyphens.",
    ),
  // Always a string in the form; empty string means "no description".
  description: z.string().max(500, "Description is too long."),
  // Validated as a 24-char hex ObjectId string. Empty string means "no cover".
  coverMediaId: z
    .string()
    .regex(/^[0-9a-f]{24}$/, "Invalid ObjectId format.")
    .or(z.literal("")),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
