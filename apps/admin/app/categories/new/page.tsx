import Link from "next/link";

import { DEFAULT_LOCALE, isLocale, type Locale } from "@repo/api/schemas/locale";

import { CategoryForm } from "../../../features/categories/components/category-form";

// Opt out of static prerendering. proxy.ts sets a per-request CSP nonce that
// would mismatch a cached static body — dynamic rendering keeps the nonce in
// sync with the response headers.
export const dynamic = "force-dynamic";

interface Props {
  // `?contentId=&locale=` seed the "create translation" flow.
  searchParams: Promise<{ contentId?: string; locale?: string }>;
}

export default async function NewCategoryPage({ searchParams }: Props) {
  const { contentId, locale: localeParam } = await searchParams;
  const locale: Locale =
    localeParam && isLocale(localeParam) ? localeParam : DEFAULT_LOCALE;

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/categories"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Categories
        </Link>
        <h1 className="text-2xl font-semibold">
          {contentId ? "New category translation" : "New category"}
        </h1>
      </div>
      <CategoryForm
        mode="create"
        initialValues={{ locale, ...(contentId ? { contentId } : {}) }}
      />
    </main>
  );
}
