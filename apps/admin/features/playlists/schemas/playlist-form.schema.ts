import { z } from "zod";

export const playlistFormSchema = z.object({
  title: z.string().min(1, "Title is required.").max(200, "Title is too long."),
  // Always a string in the form; empty string is converted to undefined at
  // the action boundary before passing to the service.
  description: z.string().max(2000, "Description is too long."),
  status: z.enum(["draft", "published"]),
});

export type PlaylistFormValues = z.infer<typeof playlistFormSchema>;
