import { describe, expect, it } from "vitest";

import { computeSurahProgress, isBookmarked } from "./quran-progress";
import type { AyahRef } from "./storage";

const ref = (surah: number, ayah: number): AyahRef => ({ surah, ayah });

describe("isBookmarked", () => {
  const bookmarks: AyahRef[] = [ref(1, 1), ref(2, 255), ref(112, 1)];

  it("returns true for a bookmarked ayah", () => {
    expect(isBookmarked(bookmarks, ref(2, 255))).toBe(true);
    expect(isBookmarked(bookmarks, ref(1, 1))).toBe(true);
  });

  it("returns false when the ayah is not bookmarked", () => {
    expect(isBookmarked(bookmarks, ref(2, 1))).toBe(false);
    expect(isBookmarked(bookmarks, ref(3, 255))).toBe(false);
  });

  it("returns false for an empty list", () => {
    expect(isBookmarked([], ref(1, 1))).toBe(false);
  });

  it("matches by surah+ayah only, ignoring optional fields", () => {
    const withExtras: AyahRef[] = [{ surah: 36, ayah: 83, numberGlobal: 3704, surahName: "Ya-Sin" }];
    expect(isBookmarked(withExtras, ref(36, 83))).toBe(true);
    expect(isBookmarked(withExtras, { surah: 36, ayah: 83 })).toBe(true);
  });
});

describe("computeSurahProgress", () => {
  const surahs = [
    { number: 1, ayahCount: 7 },
    { number: 2, ayahCount: 286 },
  ];

  it("returns null when there is no saved position", () => {
    expect(computeSurahProgress(null, surahs)).toBeNull();
  });

  it("returns null when the saved surah isn't in the list", () => {
    expect(computeSurahProgress(ref(99, 1), surahs)).toBeNull();
  });

  it("computes the percentage for the matching surah", () => {
    expect(computeSurahProgress(ref(2, 143), surahs)).toEqual({ surah: 2, pct: 50 });
  });

  it("clamps to 100", () => {
    expect(computeSurahProgress(ref(1, 7), surahs)).toEqual({ surah: 1, pct: 100 });
  });
});
