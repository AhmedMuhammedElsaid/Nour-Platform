import { describe, expect, it } from "vitest";

import { lookaheadUrls } from "./use-ayah-audio";

// Pure-logic only, per CLAUDE.md §9 — the extension's vitest env is `node`
// (no jsdom/RTL), so the element-pool behaviour this helper feeds is
// verified manually + covered by the identical algorithm's tests in
// apps/web/features/quran/hooks/use-ayah-audio.test.ts.
describe("lookaheadUrls", () => {
  const ayahs = [
    { numberGlobal: 1, audioUrl: "https://x/1.mp3" },
    { numberGlobal: 2, audioUrl: "https://x/2.mp3" },
    { numberGlobal: 3, audioUrl: null },
    { numberGlobal: 4, audioUrl: "https://x/4.mp3" },
    { numberGlobal: 5, audioUrl: "https://x/5.mp3" },
  ];

  it("returns the next `count` non-null URLs after index", () => {
    expect(lookaheadUrls(ayahs, 0, 2)).toEqual(["https://x/2.mp3", "https://x/4.mp3"]);
  });

  it("skips a null audioUrl without counting it toward `count`", () => {
    // index 1 -> next is index 2 (null, skipped) then index 3, 4.
    expect(lookaheadUrls(ayahs, 1, 2)).toEqual(["https://x/4.mp3", "https://x/5.mp3"]);
  });

  it("caps at what's available when count exceeds the remaining list", () => {
    expect(lookaheadUrls(ayahs, 3, 5)).toEqual(["https://x/5.mp3"]);
  });

  it("returns an empty array at the last index", () => {
    expect(lookaheadUrls(ayahs, 4, 2)).toEqual([]);
  });

  it("returns an empty array for an empty list", () => {
    expect(lookaheadUrls([], 0, 2)).toEqual([]);
  });

  it("returns an empty array when count is 0", () => {
    expect(lookaheadUrls(ayahs, 0, 0)).toEqual([]);
  });
});
