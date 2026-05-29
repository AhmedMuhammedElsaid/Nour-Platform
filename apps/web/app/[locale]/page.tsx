import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getPublishedPlaylists } from "@repo/api/services/playlist";
import { listCategories } from "@repo/api/services/category";
import { LOCALES, type Locale } from "@repo/api/schemas/locale";
import type { Playlist } from "@repo/api/schemas/playlist";

// Opt out of static prerendering. proxy.ts sets a per-request CSP nonce,
// which would mismatch a cached static HTML body; forcing dynamic rendering
// is also what the deploy build (no Atlas connection at build time) requires.
export const dynamic = "force-dynamic";
import { PlaylistCard } from "@/features/playlists/components/playlist-card";
import { CategoryFilterBar } from "@/features/categories/components/category-filter-bar";
import { ContinueListening } from "@/features/player/components/continue-listening";
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

// Public site origin for absolute SEO URLs — read directly (not via the env
// barrel) for the same build-time reason as the detail page.
const baseUrl = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // Homepage path is identical across locales — only the prefix changes.
  const languages = Object.fromEntries(LOCALES.map((l) => [l, `${baseUrl}/${l}`]));
  return { alternates: { canonical: `${baseUrl}/${locale}`, languages } };
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

  // Fetch all categories (no locale param — embedded ar/en on each doc).
  const categories = await listCategories();

  // Match the ?category= slug against the locale-specific slug field.
  const matchedCategory =
    category != null ? categories.find((c) => c[locale].slug === category) : undefined;
  const categoryId = matchedCategory?.id;

  const playlists = await getPublishedPlaylists(
    categoryId != null ? { categoryId } : undefined,
  );
  const serialized = playlists.map(serializePlaylist);

  // Pass locale-resolved slug + name to the CategoryFilterBar client island.
  const categoryPills = categories.map((c) => ({
    id: c.id,
    slug: c[locale].slug,
    name: c[locale].name,
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

      <ContinueListening />

    </section>
  );
}
