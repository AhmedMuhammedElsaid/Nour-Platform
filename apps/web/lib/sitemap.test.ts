import { describe, expect, it } from "vitest";

import { LOCALES } from "@repo/api/schemas/locale";

import { SITE_URL } from "./seo";
import {
  buildSitemapEntries,
  buildSitemapXml,
  escapeXml,
  renderSitemapXml,
  SITEMAP_STATIC_PATHS,
  SURAH_COUNT,
  type SitemapAzkarInput,
  type SitemapPlaylistInput,
} from "./sitemap";

// SITE_URL falls back to "http://localhost:3000" when NEXT_PUBLIC_WEB_URL is unset.
const BASE = SITE_URL;
const L = LOCALES.length;

const playlists: SitemapPlaylistInput[] = [
  {
    ar: { slug: "دروس-التفسير" },
    en: { slug: "tafsir-lessons" },
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  },
  // AR-only: the EN URL must not be emitted, but x-default still resolves.
  { ar: { slug: "خطب-الجمعة" } },
];

const adhkar: SitemapAzkarInput[] = [
  { ar: { slug: "أذكار-الصباح" }, en: { slug: "morning-adhkar" } },
];

// Entries produced without any DB data: homepage + static sections + surahs.
const STATIC_COUNT = L + SITEMAP_STATIC_PATHS.length * L + SURAH_COUNT * L;

describe("buildSitemapEntries", () => {
  it("emits the homepage, every static section and all 114 surahs per locale", () => {
    const entries = buildSitemapEntries({ playlists: [], adhkar: [] });
    expect(entries).toHaveLength(STATIC_COUNT);
  });

  it("includes each static section path under every locale prefix", () => {
    const urls = buildSitemapEntries({ playlists: [], adhkar: [] }).map((e) => e.url);
    for (const path of SITEMAP_STATIC_PATHS) {
      for (const locale of LOCALES) {
        expect(urls).toContain(`${BASE}/${locale}/${path}`);
      }
    }
  });

  it("covers the full surah range with no off-by-one at either end", () => {
    const urls = buildSitemapEntries({ playlists: [], adhkar: [] }).map((e) => e.url);
    expect(urls).toContain(`${BASE}/ar/quran/1`);
    expect(urls).toContain(`${BASE}/ar/quran/${SURAH_COUNT}`);
    expect(urls).not.toContain(`${BASE}/ar/quran/0`);
    expect(urls).not.toContain(`${BASE}/ar/quran/${SURAH_COUNT + 1}`);
  });

  it("gives every entry an x-default alternate", () => {
    const entries = buildSitemapEntries({ playlists, adhkar });
    for (const entry of entries) {
      expect(entry.alternates["x-default"]).toBeTruthy();
    }
  });

  it("points x-default at the default locale", () => {
    const home = buildSitemapEntries({ playlists: [], adhkar: [] })[0];
    expect(home?.alternates["x-default"]).toBe(`${BASE}/ar`);
  });

  it("adds playlist and adhkar entries on top of the static ones", () => {
    const entries = buildSitemapEntries({ playlists, adhkar });
    // playlists: 2 locales + 1 (ar-only) = 3; adhkar: 2.
    expect(entries).toHaveLength(STATIC_COUNT + 3 + 2);
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${BASE}/ar/playlists/دروس-التفسير`);
    expect(urls).toContain(`${BASE}/en/playlists/tafsir-lessons`);
    expect(urls).toContain(`${BASE}/ar/adhkar/أذكار-الصباح`);
    expect(urls).toContain(`${BASE}/en/adhkar/morning-adhkar`);
  });

  it("omits a locale a playlist has no slug for", () => {
    const urls = buildSitemapEntries({ playlists, adhkar: [] }).map((e) => e.url);
    expect(urls).not.toContain(`${BASE}/en/playlists/خطب-الجمعة`);
    expect(urls).toContain(`${BASE}/ar/playlists/خطب-الجمعة`);
  });

  it("only advertises hreflang alternates for locales that exist", () => {
    const arOnly = buildSitemapEntries({ playlists, adhkar: [] }).find(
      (e) => e.url === `${BASE}/ar/playlists/خطب-الجمعة`,
    );
    expect(arOnly?.alternates).toEqual({
      ar: `${BASE}/ar/playlists/خطب-الجمعة`,
      "x-default": `${BASE}/ar/playlists/خطب-الجمعة`,
    });
  });

  it("carries lastModified as an ISO string when the document has updatedAt", () => {
    const entry = buildSitemapEntries({ playlists, adhkar: [] }).find(
      (e) => e.url === `${BASE}/en/playlists/tafsir-lessons`,
    );
    expect(entry?.lastModified).toBe("2026-07-01T00:00:00.000Z");
  });

  // The DB guard in the route handler hands us empty arrays on an Atlas failure.
  it("degrades to the static entries when both DB sources come back empty", () => {
    const entries = buildSitemapEntries({ playlists: [], adhkar: [] });
    expect(entries).toHaveLength(STATIC_COUNT);
    expect(entries.map((e) => e.url)).toContain(`${BASE}/ar`);
    expect(entries.every((e) => !e.url.includes("/playlists/"))).toBe(true);
  });
});

describe("escapeXml", () => {
  it("escapes the five XML predefined entities", () => {
    expect(escapeXml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&apos;");
  });

  it("escapes an ampersand in a URL without touching Unicode", () => {
    expect(escapeXml("https://x.test/a?b=1&c=2#أ")).toBe(
      "https://x.test/a?b=1&amp;c=2#أ",
    );
  });
});

describe("renderSitemapXml", () => {
  it("wraps entries in a urlset declaring the sitemap + xhtml namespaces", () => {
    const xml = renderSitemapXml([]);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xml.trimEnd().endsWith("</urlset>")).toBe(true);
  });

  it("renders one <url> per entry with loc, changefreq, priority", () => {
    const xml = renderSitemapXml([
      {
        url: `${BASE}/ar`,
        changeFrequency: "daily",
        priority: 1,
        alternates: { ar: `${BASE}/ar`, "x-default": `${BASE}/ar` },
      },
    ]);
    expect(xml.match(/<url>/g)).toHaveLength(1);
    expect(xml).toContain(`<loc>${BASE}/ar</loc>`);
    expect(xml).toContain("<changefreq>daily</changefreq>");
    expect(xml).toContain("<priority>1.0</priority>");
    expect(xml).toContain(
      `<xhtml:link rel="alternate" hreflang="x-default" href="${BASE}/ar"/>`,
    );
  });

  // sitemaps.org requires RFC-3986-escaped URLs, but slugs are Arabic. loc and
  // href must encode identically or Google stops matching an alternate to its
  // own <loc> and the hreflang set silently loses reciprocity.
  it("percent-encodes non-ASCII slugs in both loc and alternate hrefs", () => {
    const url = `${BASE}/ar/playlists/خطب-الجمعة`;
    const encoded = `${BASE}/ar/playlists/${encodeURIComponent("خطب-الجمعة")}`;
    const xml = renderSitemapXml([
      {
        url,
        changeFrequency: "weekly",
        priority: 0.7,
        alternates: { ar: url, "x-default": url },
      },
    ]);

    expect(xml).toContain(`<loc>${encoded}</loc>`);
    expect(xml).toContain(
      `<xhtml:link rel="alternate" hreflang="ar" href="${encoded}"/>`,
    );
    // No raw Arabic survives anywhere in the serialized output.
    expect(xml).not.toContain("خطب-الجمعة");
  });

  it("emits lastmod only when the entry has one", () => {
    const withMod = renderSitemapXml([
      {
        url: `${BASE}/ar/playlists/a`,
        changeFrequency: "weekly",
        priority: 0.7,
        lastModified: "2026-07-01T00:00:00.000Z",
        alternates: {},
      },
    ]);
    expect(withMod).toContain("<lastmod>2026-07-01T00:00:00.000Z</lastmod>");
    expect(renderSitemapXml([
      { url: `${BASE}/ar`, changeFrequency: "daily", priority: 1, alternates: {} },
    ])).not.toContain("<lastmod>");
  });
});

describe("buildSitemapXml", () => {
  it("renders one <url> block per built entry", () => {
    const xml = buildSitemapXml({ playlists, adhkar });
    expect(xml.match(/<url>/g)).toHaveLength(STATIC_COUNT + 3 + 2);
  });
});
