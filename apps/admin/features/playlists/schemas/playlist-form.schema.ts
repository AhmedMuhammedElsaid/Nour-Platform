import { z } from "zod";

export const playlistFormSchema = z.object({
  title: z.string().min(1, "Title is required.").max(200, "Title is too long."),
  // Always a string in the form; empty string is converted to undefined at
  // the action boundary before passing to the service.
  description: z.string().max(2000, "Description is too long."),
  status: z.enum(["draft", "published"]),
  // Multi-select category assignment. Stores MongoDB ObjectId strings.
  // No .default() here: TanStack Form's StandardSchema validator requires the
  // Zod input type to match the form value type exactly (string[], not
  // string[] | undefined). The empty-array default lives in useForm defaultValues.
  categoryIds: z.array(z.string()),
});

export type PlaylistFormValues = z.infer<typeof playlistFormSchema>;
