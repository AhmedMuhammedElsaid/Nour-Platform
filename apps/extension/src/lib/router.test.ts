import { describe, expect, it } from "vitest";

import { parseHash, routeToHash, type Route } from "./router";

describe("parseHash", () => {
  it("treats empty / root / unknown as home", () => {
    expect(parseHash("")).toEqual({ view: "home" });
    expect(parseHash("#/")).toEqual({ view: "home" });
    expect(parseHash("#/nope")).toEqual({ view: "home" });
  });

  it("parses playlist with an optional track id", () => {
    expect(parseHash("#/playlist/abc")).toEqual({ view: "playlist", slug: "abc", trackId: undefined });
    expect(parseHash("#/playlist/abc?t=t1")).toEqual({ view: "playlist", slug: "abc", trackId: "t1" });
  });

  it("parses search, quran, and adhkar (list vs read)", () => {
    expect(parseHash("#/search?q=ruqya")).toEqual({ view: "search", q: "ruqya" });
    expect(parseHash("#/quran")).toEqual({ view: "quran" });
    expect(parseHash("#/quran/2")).toEqual({ view: "quran-read", surah: "2" });
    expect(parseHash("#/adhkar")).toEqual({ view: "adhkar" });
    expect(parseHash("#/adhkar/morning")).toEqual({ view: "adhkar-read", slug: "morning" });
  });

  it("decodes non-ASCII (Arabic) slugs", () => {
    const route = parseHash(`#/adhkar/${encodeURIComponent("أذكار-الصباح")}`);
    expect(route).toEqual({ view: "adhkar-read", slug: "أذكار-الصباح" });
  });
});

describe("routeToHash ↔ parseHash round-trip", () => {
  const routes: Route[] = [
    { view: "home" },
    { view: "playlist", slug: "أذكار-الصباح", trackId: "t9" },
    { view: "search", q: "نور" },
    { view: "adhkar" },
    { view: "adhkar-read", slug: "evening" },
    { view: "quran" },
    { view: "quran-read", surah: "114" },
    { view: "bookmarks" },
    { view: "prayer-times" },
    { view: "radio" },
  ];

  it("survives a serialise → parse cycle", () => {
    for (const route of routes) {
      expect(parseHash(`#${routeToHash(route)}`)).toEqual(
        route.view === "playlist" && route.trackId == null ? { ...route, trackId: undefined } : route,
      );
    }
  });
});
