import { describe, expect, it } from "vitest";

import { isBookmarked } from "./quran-progress";
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
