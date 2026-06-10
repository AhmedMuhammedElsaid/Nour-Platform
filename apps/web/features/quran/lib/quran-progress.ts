import { z } from "zod";

import { readDeviceStore, writeDeviceStore } from "@/lib/device-store";

const ayahRefSchema = z.object({
  surah: z.number(),
  ayah: z.number(), // ayah-in-surah
  numberGlobal: z.number().optional(),
  surahName: z.string().optional(),
});
export type AyahRef = z.infer<typeof ayahRefSchema>;

const LAST_READ_KEY = "nour.quran.lastread";
const BOOKMARKS_KEY = "nour.quran.bookmarks";

export function setLastRead(ref: AyahRef): void {
  writeDeviceStore(LAST_READ_KEY, ref);
}

export function getLastRead(): AyahRef | null {
  return readDeviceStore(LAST_READ_KEY, ayahRefSchema.nullable(), null);
}

export function getBookmarks(): AyahRef[] {
  return readDeviceStore(BOOKMARKS_KEY, z.array(ayahRefSchema), []);
}

export function isBookmarked(ref: AyahRef): boolean {
  return getBookmarks().some((b) => b.surah === ref.surah && b.ayah === ref.ayah);
}

export function toggleBookmark(ref: AyahRef): AyahRef[] {
  const current = getBookmarks();
  const exists = current.some((b) => b.surah === ref.surah && b.ayah === ref.ayah);
  const next = exists
    ? current.filter((b) => !(b.surah === ref.surah && b.ayah === ref.ayah))
    : [...current, ref];
  writeDeviceStore(BOOKMARKS_KEY, next);
  return next;
}
