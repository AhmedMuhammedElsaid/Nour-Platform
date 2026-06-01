import { z } from "zod";

import { findEmbedProvider } from "@repo/config/embed-hosts";

export const playlistFormSchema = z.object({
  ar: z.object({
    title: z.string().min(1, "Arabic title is required.").max(200, "Too long."),
    description: z.string().max(2000, "Too long."),
    scholarName: z.string().max(200, "Too long."),
  }),
  en: z.object({
    title: z.string().min(1, "English title is required.").max(200, "Too long."),
    description: z.string().max(2000, "Too long."),
    scholarName: z.string().max(200, "Too long."),
  }),
  scholarImage: z.string().max(500, "Too long."),
  embedUrl: z
    .string()
    .max(500, "Too long.")
    .refine(
      (value) => !value || findEmbedProvider(value) !== null,
      "Domain not allowed for embedding",
    ),
  status: z.enum(["draft", "published"]),
  categoryIds: z.array(z.string()),
});

export type PlaylistFormValues = z.infer<typeof playlistFormSchema>;
