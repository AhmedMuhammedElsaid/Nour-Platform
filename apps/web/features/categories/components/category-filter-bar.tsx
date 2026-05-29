"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";

interface CategoryPill {
  id: string;
  slug: string;
  arName: string;
  enName: string;
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
 * Labels are bilingual: "القرآن · Quran" format renders both language names
 * so users in either locale can identify the category at a glance.
 *
 * The ?sort= param is preserved when changing category and vice-versa.
 */
export function CategoryFilterBar({
  categories,
  activeSlug,
}: CategoryFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("categories");

  function navigate(params: URLSearchParams): void {
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  const activeClass =
    "inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold bg-primary text-primary-foreground";
  const inactiveClass =
    "inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold bg-primary/10 text-text-2 border border-primary/20 hover:bg-primary/15 hover:text-primary transition-colors";

  return (
    <nav aria-label={t("filterLabel")} className="flex flex-wrap gap-2 mt-6">
      {/* "All" pill — clears the category filter, preserves ?sort= */}
      <button
        type="button"
        onClick={() => {
          const params = new URLSearchParams(searchParams.toString());
          params.delete("category");
          navigate(params);
        }}
        aria-current={activeSlug === undefined ? "true" : undefined}
        className={activeSlug === undefined ? activeClass : inactiveClass}
      >
        {t("all")}
      </button>

      {categories.map((cat) => {
        const isActive = cat.slug === activeSlug;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("category", cat.slug);
              navigate(params);
            }}
            aria-current={isActive ? "true" : undefined}
            className={isActive ? activeClass : inactiveClass}
          >
            {cat.arName} · {cat.enName}
          </button>
        );
      })}
    </nav>
  );
}
