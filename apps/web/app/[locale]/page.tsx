import { getTranslations, setRequestLocale } from "next-intl/server";

import { getPublishedPlaylists } from "@repo/api/services/playlist";
import { listCategories } from "@repo/api/services/category";
import type { Locale } from "@repo/api/schemas/locale";
import type { Playlist } from "@repo/api/schemas/playlist";

// Opt out of static prerendering. proxy.ts sets a per-request CSP nonce,
// which would mismatch a cached static HTML body; forcing dynamic rendering
// is also what the deploy build (no Atlas connection at build time) requires.
export const dynamic = "force-dynamic";
import { PlaylistCard } from "@/features/playlists/components/playlist-card";
import { CategoryFilterBar } from "@/features/categories/components/category-filter-bar";
import type { SerializedPlaylist } from "@/features/playlists/types";

// Converts a Playlist DTO to a JSON-serializable shape. createdAt/updatedAt
// may already be ISO strings when the lean Mongo doc serializes them early;
// we guard with a typeof check so both paths are safe.
function serializePlaylist(p: Playlist): SerializedPlaylist {
  return {
    ...p,
    createdAt:
      typeof p.createdAt === "string"
        ? p.createdAt
        : p.createdAt.toISOString(),
    updatedAt:
      typeof p.updatedAt === "string"
        ? p.updatedAt
        : p.updatedAt.toISOString(),
  };
}

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Next.js 15+ passes searchParams as a Promise — must be awaited before use.
  const { category } = await searchParams;
  const t = await getTranslations("home");

  // Fetch categories (for this locale) first so we can resolve the slug → the
  // playlist filter, which keys on the locale-agnostic category contentId.
  const categories = await listCategories(locale);

  const matchedCategory =
    category != null
      ? categories.find((c) => c.slug === category)
      : undefined;
  const categoryContentId = matchedCategory?.contentId;

  const playlists = await getPublishedPlaylists(
    locale,
    categoryContentId != null ? { categoryContentId } : undefined,
  );
  const serialized = playlists.map(serializePlaylist);

  // Shape passed to the client island — slug + name only (no Dates).
  const categoryPills = categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
  }));

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="font-display text-3xl tracking-tight">{t("heading")}</h1>

      <CategoryFilterBar categories={categoryPills} activeSlug={category} />

      {serialized.length === 0 ? (
        <p className="text-muted-foreground mt-6">{t("empty")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {serialized.map((playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} />
          ))}
        </div>
      )}
    </section>
  );
}
