import type { MetadataRoute } from "next";

import { getPublishedPlaylists } from "@repo/api/services/playlist";
import { LOCALES } from "@repo/api/schemas/locale";

// Generated at request time: the build runs without Atlas connectivity, and
// playlist content is dynamic. force-dynamic keeps Next from executing the DB
// query during the build's data-collection step.
export const dynamic = "force-dynamic";

const baseUrl = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Homepage per locale (always present).
  const entries: MetadataRoute.Sitemap = LOCALES.map((locale) => ({
    url: `${baseUrl}/${locale}`,
    changeFrequency: "daily",
    priority: 1,
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((l) => [l, `${baseUrl}/${l}`]),
      ),
    },
  }));

  // Published playlist detail pages, with hreflang alternates. Guarded so a DB
  // hiccup degrades to the static routes above rather than failing the route.
  try {
    const playlists = await getPublishedPlaylists();
    for (const p of playlists) {
      for (const locale of LOCALES) {
        const slug = p[locale]?.slug;
        if (!slug) continue;
        entries.push({
          url: `${baseUrl}/${locale}/playlists/${slug}`,
          lastModified: p.updatedAt,
          changeFrequency: "weekly",
          priority: 0.7,
          alternates: {
            languages: Object.fromEntries(
              LOCALES.filter((l) => p[l]?.slug).map((l) => [
                l,
                `${baseUrl}/${l}/playlists/${p[l].slug}`,
              ]),
            ),
          },
        });
      }
    }
  } catch {
    /* DB unavailable — return the static routes only */
  }

  return entries;
}
