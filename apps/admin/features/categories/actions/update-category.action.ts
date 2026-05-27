"use server";

import { AppError } from "@repo/api/errors";
import { updateCategory } from "@repo/api/services/category";

import {
  categoryFormSchema,
  type CategoryFormValues,
} from "../schemas/category-form.schema";

export type UpdateCategoryResult = { error: string } | undefined;

export async function updateCategoryAction(
  id: string,
  input: CategoryFormValues,
): Promise<UpdateCategoryResult> {
  const parsed = categoryFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  try {
    await updateCategory(id, {
      ar: {
        name: parsed.data.ar.name,
        description: parsed.data.ar.description || undefined,
      },
      en: {
        name: parsed.data.en.name,
        description: parsed.data.en.description || undefined,
      },
      coverMediaId: parsed.data.coverMediaId || undefined,
    });
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
}
