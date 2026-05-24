"use server";

import { AppError } from "@repo/api/errors";
import { updateCategory } from "@repo/api/services/category";

import { categoryFormSchema } from "../schemas/category-form.schema";

export type UpdateCategoryResult = { error: string } | undefined;

export async function updateCategoryAction(
  id: string,
  input: {
    name: string;
    slug: string;
    description: string;
    coverMediaId: string;
  },
): Promise<UpdateCategoryResult> {
  const parsed = categoryFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  try {
    await updateCategory(id, {
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description || undefined,
      // null clears the field in the DB; undefined leaves it unchanged.
      // An empty string from the form means "remove cover".
      coverMediaId: parsed.data.coverMediaId || undefined,
    });
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
}
