import AsyncStorage from "@react-native-async-storage/async-storage";

// Device-local history backing the Home "Continue listening" / "Continue
// reading" shelves. Key names mirror the web app's localStorage keys so the
// shapes stay in sync; the WRITERS land in later phases (audio engine = Phase 6,
// Quran reader = Phase 8). Until then these reads simply return empty and the
// shelves render nothing.

const RECENT_KEY = "nour.player.recent";
const QURAN_LAST_READ_KEY = "nour.quran.lastread";

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
