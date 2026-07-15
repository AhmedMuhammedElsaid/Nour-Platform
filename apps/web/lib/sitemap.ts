import { DEFAULT_LOCALE, LOCALES, type Locale } from "@repo/api/schemas/locale";

import { SITE_URL } from "./seo";

/*
 * Pure sitemap construction. Lives outside the route handler so the entry list
 * and the XML serialization can be unit-tested without Next's request runtime
 * or a database connection — the handler only supplies the fetched data.
 *
 * We hand-serialize instead of using Next's `MetadataRoute.Sitemap` because the
 * metadata-file convention (`app/sitemap.ts`) is incompatible with
 * `dynamic = "force-dynamic"`: the route was dropped from the build and 404'd in
 * production. An explicit route handler supports force-dynamic properly.
 */

export type ChangeFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type SitemapEntry = {
  url: string;
  changeFrequency: ChangeFrequency;
  priority: number;
  /** ISO-8601 timestamp; omitted when the source has no meaningful mtime. */
  lastModified?: string;
  /** hreflang → absolute URL, always including an `x-default` key. */
  alternates: Record<string, string>;
};

/** Minimal structural shape the builder needs from an embedded-locale document. */
type LocaleSlugs = Partial<Record<Locale, { slug: string } | undefined>>;

export type SitemapPlaylistInput = LocaleSlugs & { updatedAt?: Date | string };
export type SitemapAzkarInput = LocaleSlugs;

/**
 * Locale-prefixed static sections. `privacy` is deliberately absent — it changes
 * on a completely different cadence and gets its own priority below.
 */
export const SITEMAP_SECTION_PATHS = [
  "prayer-times",
  "quran",
  "radio",
  "adhkar",
  "qibla",
] as const;

export const SITEMAP_STATIC_PATHS = [...SITEMAP_SECTION_PATHS, "privacy"] as const;

/** Surahs are fixed scripture — a pure loop, never a DB read. */
export const SURAH_COUNT = 114;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escape the five XML predefined entities. Slugs are Unicode (Arabic) and could
 * in principle carry an `&`, which would otherwise produce invalid XML that
 * Search Console rejects outright.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Alternates for a path that exists identically under every locale prefix. */
function sharedPathAlternates(path: string): Record<string, string> {
  const suffix = path ? `/${path}` : "";
  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = `${SITE_URL}/${l}${suffix}`;
  languages["x-default"] = `${SITE_URL}/${DEFAULT_LOCALE}${suffix}`;
  return languages;
}

/** Alternates for a document whose slug differs per locale (and may be missing). */
function slugAlternates(doc: LocaleSlugs, segment: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of LOCALES) {
    const slug = doc[l]?.slug;
    if (slug) languages[l] = `${SITE_URL}/${l}/${segment}/${slug}`;
  }
  const defaultSlug = doc[DEFAULT_LOCALE]?.slug;
  if (defaultSlug) {
    languages["x-default"] = `${SITE_URL}/${DEFAULT_LOCALE}/${segment}/${defaultSlug}`;
  }
  return languages;
}

function toIso(value: Date | string | undefined): string | undefined {
  if (value == null) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

// ---------------------------------------------------------------------------
// Entry list (pure)
// ---------------------------------------------------------------------------

/**
 * Build the full entry list. `playlists`/`adhkar` come from the DB and are empty
 * when the caller's guard swallowed an Atlas failure — the static entries below
 * are always produced, so a DB outage degrades the sitemap rather than 500ing.
 */
export function buildSitemapEntries(data: {
  playlists: readonly SitemapPlaylistInput[];
  adhkar: readonly SitemapAzkarInput[];
}): SitemapEntry[] {
  const entries: SitemapEntry[] = [];

  // Homepage per locale.
  for (const locale of LOCALES) {
    entries.push({
      url: `${SITE_URL}/${locale}`,
      changeFrequency: "daily",
      priority: 1,
      alternates: sharedPathAlternates(""),
    });
  }

  // Static sections.
  for (const path of SITEMAP_STATIC_PATHS) {
    const isPrivacy = path === "privacy";
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}/${path}`,
        changeFrequency: isPrivacy ? "yearly" : "weekly",
        priority: isPrivacy ? 0.3 : 0.8,
        alternates: sharedPathAlternates(path),
      });
    }
  }

  // The 114 surah reader pages.
  for (let surah = 1; surah <= SURAH_COUNT; surah++) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}/quran/${surah}`,
        changeFrequency: "yearly",
        priority: 0.6,
        alternates: sharedPathAlternates(`quran/${surah}`),
      });
    }
  }

  // Published playlists.
  for (const p of data.playlists) {
    const alternates = slugAlternates(p, "playlists");
    const lastModified = toIso(p.updatedAt);
    for (const locale of LOCALES) {
      const slug = p[locale]?.slug;
      if (!slug) continue;
      entries.push({
        url: `${SITE_URL}/${locale}/playlists/${slug}`,
        changeFrequency: "weekly",
        priority: 0.7,
        ...(lastModified != null ? { lastModified } : {}),
        alternates,
      });
    }
  }

  // Published adhkar reader pages.
  for (const a of data.adhkar) {
    const alternates = slugAlternates(a, "adhkar");
    for (const locale of LOCALES) {
      const slug = a[locale]?.slug;
      if (!slug) continue;
      entries.push({
        url: `${SITE_URL}/${locale}/adhkar/${slug}`,
        changeFrequency: "monthly",
        priority: 0.6,
        alternates,
      });
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// XML serialization (pure)
// ---------------------------------------------------------------------------

function renderEntry(entry: SitemapEntry): string {
  const lines = [`    <loc>${escapeXml(entry.url)}</loc>`];
  if (entry.lastModified != null) {
    lines.push(`    <lastmod>${escapeXml(entry.lastModified)}</lastmod>`);
  }
  lines.push(`    <changefreq>${entry.changeFrequency}</changefreq>`);
  lines.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
  for (const [hreflang, href] of Object.entries(entry.alternates)) {
    lines.push(
      `    <xhtml:link rel="alternate" hreflang="${escapeXml(hreflang)}" href="${escapeXml(href)}"/>`,
    );
  }
  return `  <url>\n${lines.join("\n")}\n  </url>`;
}

/** Serialize entries to a sitemaps.org 0.9 urlset with xhtml:link alternates. */
export function renderSitemapXml(entries: readonly SitemapEntry[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries.map(renderEntry),
    "</urlset>",
    "",
  ].join("\n");
}

/** Convenience composition used by the route handler. */
export function buildSitemapXml(data: {
  playlists: readonly SitemapPlaylistInput[];
  adhkar: readonly SitemapAzkarInput[];
}): string {
  return renderSitemapXml(buildSitemapEntries(data));
}
