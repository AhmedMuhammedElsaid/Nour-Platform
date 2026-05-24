"use server";

import { redirect } from "next/navigation";

import { AppError } from "@repo/api/errors";
import { createCategory } from "@repo/api/services/category";

// Next 16 / Turbopack rejects non-action re-exports from "use server" files.
// Importers must pull `categoryFormSchema` / `CategoryFormValues` directly
// from `../schemas/category-form.schema`. The type below stays inline because
// it's specific to this action's return shape.
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
      name: parsed.data.name,
      // Provide the slug only when the user has supplied one; otherwise the
      // service auto-derives it from the name.
      slug: parsed.data.slug || undefined,
      description: parsed.data.description || undefined,
      coverMediaId: parsed.data.coverMediaId || undefined,
    });
    redirect("/categories");
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    // Re-throw Next.js redirect — it is the success path, not an error.
    throw error;
  }
}
