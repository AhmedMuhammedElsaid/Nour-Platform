// Device-local radio favorites (no account/server state — mirrors the player's
// recently-played store). A flat list of station slugs in localStorage. The
// same key (`nour.radio.favorites`) is used verbatim on mobile.

const STORAGE_KEY = "nour.radio.favorites";

export function readFavorites(): string[] {
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

function writeFavorites(slugs: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

// Flips a slug in/out of favorites and returns the new list.
export function toggleFavorite(slug: string): string[] {
  const current = readFavorites();
  const next = current.includes(slug)
    ? current.filter((s) => s !== slug)
    : [slug, ...current];
  writeFavorites(next);
  return next;
}
