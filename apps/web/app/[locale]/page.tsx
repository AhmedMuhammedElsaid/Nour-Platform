import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getPublishedPlaylists } from "@repo/api/services/playlist";
import { listCategories } from "@repo/api/services/category";
import { LOCALES, type Locale } from "@repo/api/schemas/locale";
import type { Playlist } from "@repo/api/schemas/playlist";
import { localeAlternates, defaultOpenGraph, defaultTwitter } from "@/lib/seo";

// Opt out of static prerendering. proxy.ts sets a per-request CSP nonce,
// which would mismatch a cached static HTML body; forcing dynamic rendering
// is also what the deploy build (no Atlas connection at build time) requires.
export const dynamic = "force-dynamic";
import { PlaylistCard } from "@/features/playlists/components/playlist-card";
import { CategoryFilterBar } from "@/features/categories/components/category-filter-bar";
import { ContinueListening } from "@/features/player/components/continue-listening";
import { PlaylistSortSelect } from "@/features/playlists/components/playlist-sort-select";
import { PrayerTimesWidget } from "@/features/prayer-times/components/prayer-times-widget";
import type { SerializedPlaylist } from "@/features/playlists/types";

// Converts a Playlist DTO to a JSON-serializable shape. createdAt/updatedAt
// may already be ISO strings when the lean Mongo doc serializes them early;
// we guard with a typeof check so both paths are safe.
function serializePlaylist(p: Playlist): SerializedPlaylist {
  return {
    ...p,
    createdAt: typeof p.createdAt === "string" ? p.createdAt : p.createdAt.toISOString(),
    updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : p.updatedAt.toISOString(),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const pathByLocale = Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])) as Record<Locale, string>;
  const { canonical, languages } = localeAlternates(locale, pathByLocale);
  return {
    alternates: { canonical, languages },
    openGraph: {
      ...defaultOpenGraph(locale),
      title: t("homeTitle"),
      description: t("homeDescription"),
      url: canonical,
    },
    twitter: defaultTwitter(),
  };
}

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ category?: string; sort?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Next.js 15+ passes searchParams as a Promise — must be awaited before use.
  const { category, sort } = await searchParams;
  const t = await getTranslations("home");

  // Fetch all categories (no locale param — embedded ar/en on each doc).
  const categories = await listCategories();

  // Match the ?category= slug against the locale-specific slug field.
  const matchedCategory =
    category != null ? categories.find((c) => c[locale].slug === category) : undefined;
  const categoryId = matchedCategory?.id;

  const playlists = await getPublishedPlaylists(
    categoryId != null ? { categoryId } : undefined,
  );

  // Sort server-side from the ?sort= URL param so order is shareable and
  // the RSC grid renders the right sequence on first load.
  const sorted = [...playlists];
  if (sort === "az") {
    sorted.sort((a, b) =>
      a[locale].title.localeCompare(b[locale].title, locale),
    );
  } else if (sort === "tracks") {
    sorted.sort((a, b) => (b.trackCount ?? 0) - (a.trackCount ?? 0));
  }
  // Default (no sort param or "newest") keeps the service order (updatedAt DESC).

  const serialized = sorted.map(serializePlaylist);

  // Pass both language names to the CategoryFilterBar so it can render
  // bilingual labels ("القرآن · Quran") regardless of the active locale.
  const categoryPills = categories.map((c) => ({
    id: c.id,
    slug: c[locale].slug,
    arName: c.ar.name,
    enName: c.en.name,
  }));

  const categoryById = new Map(
    categories.map((c) => [c.id, { slug: c[locale].slug, name: c[locale].name }])
  );

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      {/* Hero */}
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold tracking-tight text-text">
          {t("heroTitle")}
        </h1>
        <p className="mt-2 text-sm text-text-2">{t("heroSubtitle")}</p>
      </div>

      <PrayerTimesWidget locale={locale} />

      <hr className="border-border my-8" />

      {/* Category filter pills */}
      <CategoryFilterBar categories={categoryPills} activeSlug={category} />

      {/* Library header: label + sort control */}
      <div className="mt-8 flex items-center justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[3px] text-primary">
          {t("library")}
        </p>
        <PlaylistSortSelect currentSort={sort} />
      </div>

      {/* Playlist grid */}
      {serialized.length === 0 ? (
        <p className="text-muted-foreground mt-6">{t("empty")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 pt-2">
          {serialized.map((playlist) => (
            <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                categories={playlist.categoryIds
                  .map((id) => categoryById.get(id))
                  .filter((c): c is { slug: string; name: string } => c != null)}
              />
          ))}
        </div>
      )}
           {/* Continue listening shelf */}
      <ContinueListening />
    </section>
  );
}
