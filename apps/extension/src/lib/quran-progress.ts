import { get, set, type AyahRef } from "./storage";

// Device-local Quran reading state (identical keys to web nour.quran.*). Async
// (browser.storage), so callers await; the reader hydrates these on mount.

export async function getLastRead(): Promise<AyahRef | null> {
  return get("nour.quran.lastread");
}

export async function setLastRead(ref: AyahRef): Promise<void> {
  await set("nour.quran.lastread", ref);
}

export async function getBookmarks(): Promise<AyahRef[]> {
  return get("nour.quran.bookmarks");
}

export function isBookmarked(list: AyahRef[], ref: AyahRef): boolean {
  return list.some((b) => b.surah === ref.surah && b.ayah === ref.ayah);
}

// Only one surah can carry a progress ring: `nour.quran.lastread` stores a
// single last-read ayah, not per-surah history (mirrors web/mobile) — every
// other surah gets null (a plain badge) rather than a fabricated 0%.
export function computeSurahProgress(
  lastRead: AyahRef | null,
  surahs: { number: number; ayahCount: number }[],
): { surah: number; pct: number } | null {
  if (!lastRead) return null;
  const surah = surahs.find((s) => s.number === lastRead.surah);
  if (!surah) return null;
  return { surah: lastRead.surah, pct: Math.min(100, Math.round((lastRead.ayah / surah.ayahCount) * 100)) };
}

// Toggles a bookmark, persists the new list, and returns it.
export async function toggleBookmark(ref: AyahRef): Promise<AyahRef[]> {
  const current = await get("nour.quran.bookmarks");
  const exists = current.some((b) => b.surah === ref.surah && b.ayah === ref.ayah);
  const next = exists
    ? current.filter((b) => !(b.surah === ref.surah && b.ayah === ref.ayah))
    : [...current, ref];
  await set("nour.quran.bookmarks", next);
  return next;
}
