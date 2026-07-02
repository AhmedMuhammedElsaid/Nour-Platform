import AsyncStorage from "@react-native-async-storage/async-storage";

// Device-local history backing the Home "Continue listening" / "Continue
// reading" shelves. Key names mirror the web app's localStorage keys so the
// shapes stay in sync; the WRITERS land in later phases (audio engine = Phase 6,
// Quran reader = Phase 8). Until then these reads simply return empty and the
// shelves render nothing.

const RECENT_KEY = "nour.player.recent";
const QURAN_LAST_READ_KEY = "nour.quran.lastread";
const QURAN_PREFS_KEY = "nour.quran.prefs";
const QURAN_BOOKMARKS_KEY = "nour.quran.bookmarks";
const ADHKAR_PROGRESS_KEY = "nour.adhkar.progress";
const RADIO_FAVORITES_KEY = "nour.radio.favorites";
const RADIO_RECENT_KEY = "nour.radio.recent";
const RADIO_RECENT_MAX = 12;

export type RecentTrack = {
  trackId: string;
  title: string;
  playlistTitle?: string;
  playlistSlug?: string;
  duration?: number;
  updatedAt: number;
};

export type AyahRef = {
  surah: number;
  ayahInSurah: number;
  numberGlobal?: number;
  surahName?: string;
};

function isRecentTrack(value: unknown): value is RecentTrack {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as RecentTrack).trackId === "string" &&
    typeof (value as RecentTrack).title === "string"
  );
}

async function read<T>(key: string, isValid: (v: unknown) => boolean): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? (parsed as T) : null;
  } catch {
    return null;
  }
}

export async function readRecentlyPlayed(): Promise<RecentTrack[]> {
  const list = await read<RecentTrack[]>(
    RECENT_KEY,
    (v): v is RecentTrack[] => Array.isArray(v),
  );
  return (list ?? []).filter(isRecentTrack);
}

export async function getQuranLastRead(): Promise<AyahRef | null> {
  return read<AyahRef>(
    QURAN_LAST_READ_KEY,
    (v): v is AyahRef =>
      typeof v === "object" &&
      v !== null &&
      typeof (v as AyahRef).surah === "number",
  );
}

export async function setQuranLastRead(ref: AyahRef): Promise<void> {
  try {
    await AsyncStorage.setItem(QURAN_LAST_READ_KEY, JSON.stringify(ref));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

// ---------------------------------------------------------------------------
// Quran reader prefs — `nour.quran.prefs`. Mirrors the web shape
// (apps/web/features/quran/lib/quran-prefs.ts) minus the `layout` field
// (mushaf-page toggle is deferred). `translationSlug: ""` means "let the
// server resolve the locale default" (ar.muyassar / en.sahih); a non-empty
// value is an explicit user override passed as the ?translation= param.
// ---------------------------------------------------------------------------

export type QuranPrefs = {
  translationSlug: string;
  reciterSlug: string;
  showTranslation: boolean;
  showWordByWord: boolean;
  fontScale: number; // 1 = base; clamped 0.8..1.6 by the settings UI
};

export const DEFAULT_QURAN_PREFS: QuranPrefs = {
  translationSlug: "",
  reciterSlug: "alafasy",
  showTranslation: true,
  showWordByWord: false,
  fontScale: 1,
};

function isQuranPrefs(value: unknown): value is Partial<QuranPrefs> {
  return typeof value === "object" && value !== null;
}

export async function getQuranPrefs(): Promise<QuranPrefs> {
  const stored = await read<Partial<QuranPrefs>>(QURAN_PREFS_KEY, isQuranPrefs);
  return { ...DEFAULT_QURAN_PREFS, ...(stored ?? {}) };
}

export async function setQuranPrefs(prefs: QuranPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(QURAN_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

// ---------------------------------------------------------------------------
// Quran bookmarks — `nour.quran.bookmarks`. Array of AyahRef, deduped by
// (surah, ayahInSurah). Mirrors apps/web/features/quran/lib/quran-progress.ts.
// ---------------------------------------------------------------------------

export async function getQuranBookmarks(): Promise<AyahRef[]> {
  const list = await read<AyahRef[]>(
    QURAN_BOOKMARKS_KEY,
    (v): v is AyahRef[] => Array.isArray(v),
  );
  return list ?? [];
}

export function isAyahBookmarked(list: AyahRef[], ref: AyahRef): boolean {
  return list.some((b) => b.surah === ref.surah && b.ayahInSurah === ref.ayahInSurah);
}

export async function toggleQuranBookmark(ref: AyahRef): Promise<AyahRef[]> {
  const current = await getQuranBookmarks();
  const exists = isAyahBookmarked(current, ref);
  const next = exists
    ? current.filter((b) => !(b.surah === ref.surah && b.ayahInSurah === ref.ayahInSurah))
    : [...current, ref];
  try {
    await AsyncStorage.setItem(QURAN_BOOKMARKS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — non-fatal */
  }
  return next;
}

// ---------------------------------------------------------------------------
// Adhkar progress — `nour.adhkar.progress`. Mirrors the web shape exactly
// (apps/web/features/adhkar/lib/adhkar-progress.ts): resets each calendar day
// so morning/evening adhkar behave like a daily checklist. Ported with both
// readers AND writers (unlike the player/Quran shelves) since the Adhkar
// reader ships in this phase.
// ---------------------------------------------------------------------------

export type AzkarProgress = {
  date: string; // YYYY-MM-DD (local)
  sets: Record<string, Record<string, number>>; // setId -> itemIndex -> count
};

function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function emptyProgress(): AzkarProgress {
  return { date: today(), sets: {} };
}

function isAzkarProgress(value: unknown): value is AzkarProgress {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as AzkarProgress).date === "string" &&
    typeof (value as AzkarProgress).sets === "object"
  );
}

async function readProgress(): Promise<AzkarProgress> {
  const parsed = await read<AzkarProgress>(ADHKAR_PROGRESS_KEY, isAzkarProgress);
  return parsed ?? emptyProgress();
}

async function writeProgress(p: AzkarProgress): Promise<void> {
  try {
    await AsyncStorage.setItem(ADHKAR_PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

// Clears all progress if the stored date isn't today. Call on mount.
export async function resetAzkarProgressIfNewDay(): Promise<AzkarProgress> {
  const current = await readProgress();
  if (current.date === today()) return current;
  const fresh = emptyProgress();
  await writeProgress(fresh);
  return fresh;
}

export async function getAzkarProgress(): Promise<AzkarProgress> {
  return readProgress();
}

// Sets the absolute count for one dhikr (clamped >= 0). Returns new state.
export async function recordDhikrCount(
  setId: string,
  itemIndex: number,
  count: number,
): Promise<AzkarProgress> {
  const p = await readProgress();
  const set = p.sets[setId] ?? {};
  set[String(itemIndex)] = Math.max(0, count);
  p.sets[setId] = set;
  await writeProgress(p);
  return p;
}

// Clears all recorded counts for one set so the user can start over.
export async function resetAzkarSet(setId: string): Promise<AzkarProgress> {
  const p = await readProgress();
  delete p.sets[setId];
  await writeProgress(p);
  return p;
}

// Count of items fully completed for a set — drives landing progress bars.
export function azkarCompletedCount(progress: AzkarProgress, setId: string, repeats: number[]): number {
  const set = progress.sets[setId] ?? {};
  return repeats.reduce((n, r, i) => n + ((set[String(i)] ?? 0) >= r ? 1 : 0), 0);
}

// ---------------------------------------------------------------------------
// Radio favorites + recently-played — `nour.radio.favorites` / `nour.radio.recent`.
// Flat lists of station slugs. Same keys/shape the web radio feature uses
// (apps/web/features/radio/lib/radio-favorites.ts + radio-recent.ts) so device
// state stays conceptually in sync across surfaces.
// ---------------------------------------------------------------------------

async function readSlugList(key: string): Promise<string[]> {
  const list = await read<string[]>(key, (v): v is string[] => Array.isArray(v));
  return (list ?? []).filter((s): s is string => typeof s === "string");
}

async function writeSlugList(key: string, slugs: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(slugs));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export async function getRadioFavorites(): Promise<string[]> {
  return readSlugList(RADIO_FAVORITES_KEY);
}

// Flips a slug in/out of favorites and returns the new list.
export async function toggleRadioFavorite(slug: string): Promise<string[]> {
  const current = await getRadioFavorites();
  const next = current.includes(slug)
    ? current.filter((s) => s !== slug)
    : [slug, ...current];
  await writeSlugList(RADIO_FAVORITES_KEY, next);
  return next;
}

export async function getRecentStations(): Promise<string[]> {
  return readSlugList(RADIO_RECENT_KEY);
}

// Records a play: dedupes, moves to front (MRU), caps the list. Returns the list.
export async function recordRecentStation(slug: string): Promise<string[]> {
  const current = await getRecentStations();
  const next = [slug, ...current.filter((s) => s !== slug)].slice(0, RADIO_RECENT_MAX);
  await writeSlugList(RADIO_RECENT_KEY, next);
  return next;
}
