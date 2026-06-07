import { afterEach, describe, expect, it } from "vitest";
import {
  setLastRead,
  getLastRead,
  toggleBookmark,
  getBookmarks,
  isBookmarked,
} from "./quran-progress";

afterEach(() => window.localStorage.clear());

describe("quran-progress", () => {
  it("stores and reads last-read position", () => {
    setLastRead({ surah: 2, ayah: 255 });
    expect(getLastRead()).toEqual({ surah: 2, ayah: 255 });
  });

  it("returns null when no last-read is set", () => {
    expect(getLastRead()).toBeNull();
  });

  it("toggles a bookmark on then off", () => {
    toggleBookmark({ surah: 1, ayah: 1 });
    expect(isBookmarked({ surah: 1, ayah: 1 })).toBe(true);
    expect(getBookmarks()).toHaveLength(1);
    toggleBookmark({ surah: 1, ayah: 1 });
    expect(isBookmarked({ surah: 1, ayah: 1 })).toBe(false);
    expect(getBookmarks()).toHaveLength(0);
  });

  it("stores numberGlobal and surahName on last-read", () => {
    setLastRead({ surah: 1, ayah: 1, numberGlobal: 1, surahName: "Al-Faatiha" });
    expect(getLastRead()).toEqual({ surah: 1, ayah: 1, numberGlobal: 1, surahName: "Al-Faatiha" });
  });

  it("keeps numberGlobal/surahName on bookmarks", () => {
    toggleBookmark({ surah: 2, ayah: 255, numberGlobal: 262, surahName: "Al-Baqara" });
    const b = getBookmarks()[0]!;
    expect(b.numberGlobal).toBe(262);
    expect(b.surahName).toBe("Al-Baqara");
  });

  it("tolerates legacy records without the new fields", () => {
    window.localStorage.setItem("nour.quran.lastread", JSON.stringify({ surah: 1, ayah: 1 }));
    expect(getLastRead()).toEqual({ surah: 1, ayah: 1 });
  });
});
