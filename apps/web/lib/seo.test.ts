import { describe, expect, it } from "vitest";

import {
  absoluteUrl,
  breadcrumbLd,
  musicPlaylistLd,
  localeAlternates,
  organizationLd,
  SITE_NAME,
  SITE_URL,
  webSiteLd,
} from "./seo";

// SITE_URL falls back to "http://localhost:3000" when NEXT_PUBLIC_WEB_URL is unset.
const BASE = SITE_URL;

describe("absoluteUrl", () => {
  it("prepends SITE_URL to a relative path", () => {
    expect(absoluteUrl("/ar")).toBe(`${BASE}/ar`);
  });

  it("adds a leading slash if missing", () => {
    expect(absoluteUrl("ar/playlists/test")).toBe(`${BASE}/ar/playlists/test`);
  });

  it("is idempotent for an already-absolute URL", () => {
    expect(absoluteUrl("https://example.com/foo")).toBe("https://example.com/foo");
  });
});

describe("localeAlternates", () => {
  const paths = { ar: "/ar", en: "/en" } as const;

  it("sets canonical to the current locale path", () => {
    const { canonical } = localeAlternates("ar", paths);
    expect(canonical).toBe(`${BASE}/ar`);
  });

  it("emits both locale hreflang entries", () => {
    const { languages } = localeAlternates("en", paths);
    expect(languages["ar"]).toBe(`${BASE}/ar`);
    expect(languages["en"]).toBe(`${BASE}/en`);
  });

  it("emits an x-default entry pointing at the default locale (ar)", () => {
    const { languages } = localeAlternates("en", paths);
    expect(languages["x-default"]).toBe(`${BASE}/ar`);
  });

  it("omits a locale whose path is absent from pathByLocale", () => {
    const { languages } = localeAlternates("ar", { ar: "/ar" });
    expect(languages["en"]).toBeUndefined();
    // x-default still exists (falls back to current path)
    expect(languages["x-default"]).toBeDefined();
  });
});

describe("organizationLd", () => {
  it("has the expected @context and @type", () => {
    const ld = organizationLd();
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("Organization");
  });

  it("uses SITE_NAME as the name", () => {
    expect(organizationLd()["name"]).toBe(SITE_NAME);
  });
});

describe("webSiteLd", () => {
  it("has the expected @context and @type", () => {
    const ld = webSiteLd("ar");
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("WebSite");
  });

  it("includes a SearchAction potentialAction", () => {
    const ld = webSiteLd("ar");
    const action = ld["potentialAction"] as Record<string, unknown>;
    expect(action["@type"]).toBe("SearchAction");
    const target = action["target"] as Record<string, unknown>;
    expect(target["urlTemplate"]).toContain("/ar/search?q=");
  });

  it("sets inLanguage to the given locale", () => {
    expect(webSiteLd("en")["inLanguage"]).toBe("en");
    expect(webSiteLd("ar")["inLanguage"]).toBe("ar");
  });
});

describe("musicPlaylistLd", () => {
  const input = {
    title: "Test Playlist",
    description: "A test",
    url: `${BASE}/ar/playlists/test`,
    image: "https://r2.example.com/cover.jpg",
    numTracks: 5,
    locale: "ar" as const,
  };

  it("has the expected @context and @type", () => {
    const ld = musicPlaylistLd(input);
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("MusicPlaylist");
  });

  it("includes numTracks when provided", () => {
    expect(musicPlaylistLd(input)["numTracks"]).toBe(5);
  });

  it("omits numTracks when undefined", () => {
    const ld = musicPlaylistLd({ ...input, numTracks: undefined });
    expect(ld["numTracks"]).toBeUndefined();
  });

  it("omits description when null", () => {
    const ld = musicPlaylistLd({ ...input, description: null });
    expect(ld["description"]).toBeUndefined();
  });
});

describe("breadcrumbLd", () => {
  const items = [
    { name: "Nour", url: `${BASE}/ar` },
    { name: "My Playlist", url: `${BASE}/ar/playlists/my-playlist` },
  ];

  it("has the expected @context and @type", () => {
    const ld = breadcrumbLd(items);
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("BreadcrumbList");
  });

  it("emits an itemListElement per crumb with 1-based position", () => {
    const list = breadcrumbLd(items)["itemListElement"] as Array<Record<string, unknown>>;
    expect(list).toHaveLength(2);
    expect(list[0]?.["position"]).toBe(1);
    expect(list[1]?.["position"]).toBe(2);
    expect(list[0]?.["name"]).toBe("Nour");
    expect(list[1]?.["item"]).toBe(`${BASE}/ar/playlists/my-playlist`);
  });
});
