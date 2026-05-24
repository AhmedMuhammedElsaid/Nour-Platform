"use server";

import { AppError } from "@repo/api/errors";
import { deleteCategory } from "@repo/api/services/category";

export type DeleteCategoryResult = { error: string } | { ok: true };

export async function deleteCategoryAction(
  id: string,
): Promise<DeleteCategoryResult> {
  if (!id) return { error: "Category ID is required." };

  try {
    await deleteCategory(id);
    return { ok: true };
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    return { error: "An unexpected error occurred." };
  }
}
