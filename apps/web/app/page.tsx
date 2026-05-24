import type { Metadata } from "next";

import { getPublishedPlaylists } from "@repo/api/services/playlist";
import { listCategories } from "@repo/api/services/category";

// Opt out of static prerendering. proxy.ts sets a per-request CSP nonce,
// which would mismatch a cached static HTML body; forcing dynamic rendering
// is also what the deploy build (no Atlas connection at build time) requires.
export const dynamic = "force-dynamic";
import { PlaylistCard } from "@/features/playlists/components/playlist-card";
import { CategoryFilterBar } from "@/features/categories/components/category-filter-bar";
import type { SerializedPlaylist } from "@/features/playlists/types";
import type { Playlist } from "@repo/api/schemas/playlist";

export const metadata: Metadata = {
  title: "Nour — Islamic Audio",
  description: "Browse playlists",
};

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
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  // Next.js 15+ passes searchParams as a Promise — must be awaited before use.
  const { category } = await searchParams;

  // Fetch categories first so we can resolve the slug → ObjectId for the
  // playlist filter. The categoryId query field requires a 24-char hex
  // ObjectId string, not a slug, so we can't pass `category` directly.
  const categories = await listCategories();

  // Resolve the slug param to an ObjectId string. If the slug is unknown or
  // absent, categoryId stays undefined and getPublishedPlaylists returns all.
  const matchedCategory =
    category != null
      ? categories.find((c) => c.slug === category)
      : undefined;
  const categoryId = matchedCategory?.id;

  const playlists = await getPublishedPlaylists(
    categoryId != null ? { categoryId } : undefined,
  );
  const serialized = playlists.map(serializePlaylist);

  // Shape passed to the client island — id, slug, name only (no Dates).
  const categoryPills = categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
  }));

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="font-display text-3xl tracking-tight">Playlists</h1>

      <CategoryFilterBar categories={categoryPills} activeSlug={category} />

      {serialized.length === 0 ? (
        <p className="text-muted-foreground mt-6">
          No playlists in this category yet.
        </p>
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
