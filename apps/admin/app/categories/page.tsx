import Link from "next/link";

import { requireSession } from "@repo/api/auth";
import { listCategories } from "@repo/api/services/category";

import type { SerializedCategory } from "../../features/categories/components/categories-table";
import { CategoriesTable } from "../../features/categories/components/categories-table";

// Opt out of static prerendering. proxy.ts sets a per-request CSP nonce that
// would mismatch a cached static body, and the deploy build runs without an
// Atlas connection — both reasons require dynamic rendering.
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  // Gate the page to admin users only; listCategories() is a public-read service.
  await requireSession(["admin"]);
  const categories = await listCategories();

  // Date objects cannot cross the RSC→client boundary; serialize to ISO strings.
  const rows: SerializedCategory[] = categories.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <Link
          href="/categories/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New category
        </Link>
      </div>
      <CategoriesTable categories={rows} />
    </main>
  );
}
