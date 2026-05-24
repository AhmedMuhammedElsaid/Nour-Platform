import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@repo/api/auth";
import { getCategoryById } from "@repo/api/services/category";

import { CategoryForm } from "../../../../features/categories/components/category-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditCategoryPage({ params }: Props) {
  const { id } = await params;
  await requireSession(["admin"]);
  const category = await getCategoryById(id);

  if (!category) notFound();

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/categories"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Categories
        </Link>
        <h1 className="text-2xl font-semibold">Edit category</h1>
      </div>
      <CategoryForm
        mode="edit"
        categoryId={category.id}
        initialValues={{
          name: category.name,
          slug: category.slug,
          description: category.description ?? "",
          coverMediaId: category.coverMediaId ?? "",
        }}
      />
    </main>
  );
}
