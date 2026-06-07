export interface AyahRef {
  surah: number;
  ayah: number; // ayah-in-surah
  numberGlobal?: number;
  surahName?: string;
}

const LAST_READ_KEY = "nour.quran.lastread";
const BOOKMARKS_KEY = "nour.quran.bookmarks";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // best-effort
  }
}

export function setLastRead(ref: AyahRef): void {
  write(LAST_READ_KEY, ref);
}

export function getLastRead(): AyahRef | null {
  return read<AyahRef | null>(LAST_READ_KEY, null);
}

export function getBookmarks(): AyahRef[] {
  return read<AyahRef[]>(BOOKMARKS_KEY, []);
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
  write(BOOKMARKS_KEY, next);
  return next;
}
