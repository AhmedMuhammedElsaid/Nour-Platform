// Device-local "recently played" history backing the homepage "Continue
// listening" shelf. No account/server state (APP_CONTEXT: device-local) —
// everything lives in localStorage, MRU-ordered and capped.

const STORAGE_KEY = "nour.player.recent";
const MAX_ENTRIES = 20;

export type RecentTrack = {
  trackId: string;
  title: string;
  coverUrl?: string;
  playlistTitle?: string;
  playlistSlug?: string;
  locale?: string;
  // Total track duration in seconds — populated from DB or audio metadata.
  // Absent on entries recorded before this field was added; shelf skips the
  // progress bar when missing.
  duration?: number;
  updatedAt: number;
};

function isRecentTrack(value: unknown): value is RecentTrack {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as RecentTrack).trackId === "string" &&
    typeof (value as RecentTrack).title === "string"
  );
}

export function readRecentlyPlayed(): RecentTrack[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentTrack);
  } catch {
    return [];
  }
}

// Record a play. Dedupes by trackId, moves the entry to the front (most
// recent), and caps the list. Returns the new list for optional reuse.
export function recordRecentlyPlayed(
  track: Omit<RecentTrack, "updatedAt">,
): RecentTrack[] {
  if (typeof window === "undefined") return [];
  const existing = readRecentlyPlayed().filter(
    (t) => t.trackId !== track.trackId,
  );
  const next: RecentTrack[] = [
    { ...track, updatedAt: Date.now() },
    ...existing,
  ].slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — non-fatal */
  }
  return next;
}

export function clearRecentlyPlayed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* non-fatal */
  }
}

// Read-only access to the positions store written by player-context.tsx.
// Exposes the saved resume position for a single track without the web layer
// depending on the player-context internals directly.
const POSITIONS_STORAGE_KEY = "nour.player.positions";

export function getSavedPosition(trackId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(POSITIONS_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as Record<string, { t?: number }>;
    return parsed[trackId]?.t ?? 0;
  } catch {
    return 0;
  }
}
