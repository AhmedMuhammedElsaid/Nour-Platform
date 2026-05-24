import Link from "next/link";

import { CategoryForm } from "../../../features/categories/components/category-form";

// Opt out of static prerendering. proxy.ts sets a per-request CSP nonce that
// would mismatch a cached static body — dynamic rendering keeps the nonce in
// sync with the response headers.
export const dynamic = "force-dynamic";

export default function NewCategoryPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/categories"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Categories
        </Link>
        <h1 className="text-2xl font-semibold">New category</h1>
      </div>
      <CategoryForm mode="create" />
    </main>
  );
}
