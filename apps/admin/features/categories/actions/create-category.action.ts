"use server";

import { redirect } from "next/navigation";

import { AppError } from "@repo/api/errors";
import { createCategory } from "@repo/api/services/category";

import {
  categoryFormSchema,
  type CategoryFormValues,
} from "../schemas/category-form.schema";

type CreateCategoryResult = { error: string } | undefined;

export async function createCategoryAction(
  input: CategoryFormValues,
): Promise<CreateCategoryResult> {
  const parsed = categoryFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  try {
    await createCategory({
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
    redirect("/categories");
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
}
