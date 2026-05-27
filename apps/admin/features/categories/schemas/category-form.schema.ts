import { z } from "zod";

export const categoryFormSchema = z.object({
  ar: z.object({
    name: z.string().min(1, "Arabic name is required.").max(100, "Too long."),
    description: z.string().max(500, "Too long."),
  }),
  en: z.object({
    name: z.string().min(1, "English name is required.").max(100, "Too long."),
    description: z.string().max(500, "Too long."),
  }),
  coverMediaId: z
    .string()
    .regex(/^[0-9a-f]{24}$/, "Invalid ObjectId format.")
    .or(z.literal("")),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
