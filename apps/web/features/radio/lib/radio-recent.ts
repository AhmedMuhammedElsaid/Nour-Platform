// Device-local "recently played" radio history. Parallel to the player's
// nour.player.recent store but keyed by station slug — radio ids are synthetic
// (`radio:<slug>`) and have no playlist route, so they don't belong in the main
// "Continue listening" shelf. Same `nour.radio.recent` key on mobile.

const STORAGE_KEY = "nour.radio.recent";
const MAX_ENTRIES = 12;

export function readRecentStations(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

// Records a play: dedupes, moves to front (MRU), caps the list. Returns the list.
export function recordRecentStation(slug: string): string[] {
  if (typeof window === "undefined") return [];
  const next = [slug, ...readRecentStations().filter((s) => s !== slug)].slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* non-fatal */
  }
  return next;
}
