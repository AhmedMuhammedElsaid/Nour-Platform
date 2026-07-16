import { get, set } from "./storage";

// Device-local radio favorites + recently-played. Same keys/shape as web
// (features/radio/lib/radio-favorites.ts + radio-recent.ts) and mobile
// (lib/device-local.ts radio section) — flat slug arrays, MRU order.

const RECENT_MAX = 12;

export async function getRadioFavorites(): Promise<string[]> {
  return get("nour.radio.favorites");
}

// Flips a slug in/out of favorites and returns the new list.
export async function toggleRadioFavorite(slug: string): Promise<string[]> {
  const current = await getRadioFavorites();
  const next = current.includes(slug)
    ? current.filter((s) => s !== slug)
    : [slug, ...current];
  await set("nour.radio.favorites", next);
  return next;
}

export async function getRecentStations(): Promise<string[]> {
  return get("nour.radio.recent");
}

// Records a play: dedupes, moves to front (MRU), caps the list. Returns the list.
export async function recordRecentStation(slug: string): Promise<string[]> {
  const current = await getRecentStations();
  const next = [slug, ...current.filter((s) => s !== slug)].slice(0, RECENT_MAX);
  await set("nour.radio.recent", next);
  return next;
}
