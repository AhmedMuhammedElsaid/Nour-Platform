import type { MetadataRoute } from "next";

import { getPublishedPlaylists } from "@repo/api/services/playlist";
import { DEFAULT_LOCALE, LOCALES } from "@repo/api/schemas/locale";
import { SITE_URL } from "@/lib/seo";

// Generated at request time: the build runs without Atlas connectivity, and
// playlist content is dynamic. force-dynamic keeps Next from executing the DB
// query during the build's data-collection step.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Homepage per locale (always present).
  const entries: MetadataRoute.Sitemap = LOCALES.map((locale) => ({
    url: `${SITE_URL}/${locale}`,
    changeFrequency: "daily",
    priority: 1,
    alternates: {
      languages: {
        ...Object.fromEntries(
          LOCALES.map((l) => [l, `${SITE_URL}/${l}`]),
        ),
        "x-default": `${SITE_URL}/${DEFAULT_LOCALE}`,
      },
    },
  }));

  // Static content routes (locale-prefixed, hreflang alternates + x-default).
  const staticPaths = ["privacy"] as const;
  for (const path of staticPaths) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}/${path}`,
        changeFrequency: "yearly",
        priority: 0.3,
        alternates: {
          languages: {
            ...Object.fromEntries(
              LOCALES.map((l) => [l, `${SITE_URL}/${l}/${path}`]),
            ),
            "x-default": `${SITE_URL}/${DEFAULT_LOCALE}/${path}`,
          },
        },
      });
    }
  }

  // Published playlist detail pages, with hreflang alternates (including x-default).
  // Guarded so a DB hiccup degrades to the static routes above rather than failing.
  try {
    const playlists = await getPublishedPlaylists();
    for (const p of playlists) {
      for (const locale of LOCALES) {
        const slug = p[locale]?.slug;
        if (!slug) continue;
        const localeLanguages = Object.fromEntries(
          LOCALES.filter((l) => p[l]?.slug).map((l) => [
            l,
            `${SITE_URL}/${l}/playlists/${p[l].slug}`,
          ]),
        );
        const defaultSlug = p[DEFAULT_LOCALE]?.slug;
        entries.push({
          url: `${SITE_URL}/${locale}/playlists/${slug}`,
          lastModified: p.updatedAt,
          changeFrequency: "weekly",
          priority: 0.7,
          alternates: {
            languages: {
              ...localeLanguages,
              ...(defaultSlug
                ? { "x-default": `${SITE_URL}/${DEFAULT_LOCALE}/playlists/${defaultSlug}` }
                : {}),
            },
          },
        });
      }
    }
  } catch {
    /* DB unavailable — return the static routes only */
  }

  return entries;
}
