import { z } from "zod";

export const categoryFormSchema = z.object({
  name: z.string().min(1, "Name is required.").max(100, "Name is too long."),
  // Slug is validated against the same pattern as the DB schema.
  // Empty string is converted to undefined at the action boundary when the
  // service auto-derives the slug from the name.
  slug: z
    .string()
    .min(1, "Slug is required.")
    .max(200, "Slug is too long.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase alphanumeric with hyphens.",
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
