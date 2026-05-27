"use client";

import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";

interface CategoryPill {
  id: string;
  slug: string;
  name: string;
}

interface CategoryFilterBarProps {
  categories: CategoryPill[];
  activeSlug: string | undefined;
}

/*
 * CategoryFilterBar — P2-A.7. Client island that drives the category filter
 * on the homepage. Active state is derived entirely from the `activeSlug` prop
 * (sourced from `searchParams` in the RSC parent) — no local state.
 *
 * Navigation is client-side after first load (`useRouter().push`) so the
 * browser doesn't perform a full-page reload on each pill click.
 */
export function CategoryFilterBar({
  categories,
  activeSlug,
}: CategoryFilterBarProps) {
  const router = useRouter();
  const t = useTranslations("categories");

  return (
    <nav
      aria-label={t("filterLabel")}
      className="flex flex-wrap gap-2 mt-6"
    >
      {/* "All" pill — clears the category filter */}
      <button
        type="button"
        onClick={() => router.push("/")}
        aria-current={activeSlug === undefined ? "true" : undefined}
        className={
          activeSlug === undefined
            ? "inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium bg-primary text-primary-foreground"
            : "inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium border border-input hover:bg-accent transition-colors"
        }
      >
        {t("all")}
      </button>

      {categories.map((cat) => {
        const isActive = cat.slug === activeSlug;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => router.push(`/?category=${cat.slug}`)}
            aria-current={isActive ? "true" : undefined}
            className={
              isActive
                ? "inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium bg-primary text-primary-foreground"
                : "inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium border border-input hover:bg-accent transition-colors"
            }
          >
            {cat.name}
          </button>
        );
      })}
    </nav>
  );
}
