import type { Metadata } from "next";

import { DEFAULT_LOCALE, LOCALES, type Locale } from "@repo/api/schemas/locale";

/*
 * Single source of truth for SEO primitives across the public web app.
 *
 * `SITE_URL` is read straight from `process.env` (NOT the `@repo/config/env`
 * barrel) because this module is imported by files that run during `next build`
 * (sitemap/robots/metadata) where the barrel's required secrets aren't present.
 * `NEXT_PUBLIC_*` is build-inlined and not a secret — same documented exception
 * as the health route and next.config.ts (CLAUDE.md §5 / APP_CONTEXT gotchas).
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

export const SITE_NAME = "Nour";

// Default social-share image. The asset lives in apps/web/public/ (supplied by
// the user). Relative paths resolve against `metadataBase` (set in the root
// layout), so consumers can pass this bare string anywhere Next resolves URLs.
export const OG_IMAGE = "/og-image.png";

/** Build an absolute URL from a site-relative path (idempotent for absolute input). */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${suffix}`;
}

/**
 * Build canonical + hreflang alternates for a route that exists in one or more
 * locales. `pathByLocale` maps a locale to its full site-relative path
 * (locale prefix included, e.g. `/ar/playlists/<slug>`); omit a locale whose
 * translation/slug is missing. Always emits an `x-default` entry pointing at the
 * default-locale variant (Google's recommended fallback for unmatched locales).
 */
export function localeAlternates(
  currentLocale: Locale,
  pathByLocale: Partial<Record<Locale, string>>,
): { canonical: string; languages: Record<string, string> } {
  const currentPath = pathByLocale[currentLocale] ?? `/${currentLocale}`;

  const languages: Record<string, string> = {};
  for (const l of LOCALES) {
    const p = pathByLocale[l];
    if (p) languages[l] = absoluteUrl(p);
  }

  const defaultPath = pathByLocale[DEFAULT_LOCALE] ?? currentPath;
  languages["x-default"] = absoluteUrl(defaultPath);

  return { canonical: absoluteUrl(currentPath), languages };
}

// ---------------------------------------------------------------------------
// Default OpenGraph / Twitter blocks
// ---------------------------------------------------------------------------

/** Site-wide OpenGraph defaults; pages may override individual fields. */
export function defaultOpenGraph(locale: Locale): Metadata["openGraph"] {
  return {
    type: "website",
    siteName: SITE_NAME,
    locale,
    images: [{ url: OG_IMAGE }],
  };
}

/** Site-wide Twitter card defaults. `site`/`creator` omitted until a handle exists. */
export function defaultTwitter(): Metadata["twitter"] {
  return {
    card: "summary_large_image",
    images: [OG_IMAGE],
  };
}

// ---------------------------------------------------------------------------
// JSON-LD (schema.org) builders — return plain objects, serialized by <JsonLd>
// ---------------------------------------------------------------------------

export type JsonLdObject = Record<string, unknown>;

/** schema.org Organization for the publisher (site-wide). */
export function organizationLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/android-chrome-512x512.png"),
  };
}

/**
 * schema.org WebSite with a SearchAction (enables the Google sitelinks search
 * box). `urlTemplate` points at the locale-prefixed search route.
 */
export function webSiteLd(locale: Locale): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl(`/${locale}`),
    inLanguage: locale,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl(`/${locale}/search?q={search_term_string}`),
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** schema.org MusicPlaylist for a playlist detail page. */
export function musicPlaylistLd(input: {
  title: string;
  description?: string | null;
  url: string;
  image?: string | null;
  numTracks?: number;
  locale: Locale;
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "MusicPlaylist",
    name: input.title,
    ...(input.description ? { description: input.description } : {}),
    url: input.url,
    inLanguage: input.locale,
    ...(input.image ? { image: input.image } : {}),
    ...(input.numTracks != null ? { numTracks: input.numTracks } : {}),
  };
}

/** schema.org WebPage for a static content route (privacy, about, etc.). */
export function webPageLd(input: {
  name: string;
  description?: string;
  url: string;
  locale: Locale;
  dateModified?: string;
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    url: input.url,
    inLanguage: input.locale,
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: absoluteUrl(`/${input.locale}`) },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
}

/** schema.org BreadcrumbList from an ordered list of {name, url} crumbs. */
export function breadcrumbLd(items: { name: string; url: string }[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
