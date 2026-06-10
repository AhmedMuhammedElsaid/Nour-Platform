// Device-local "recently played" history backing the homepage "Continue
// listening" shelf. No account/server state (APP_CONTEXT: device-local) —
// everything lives in localStorage, MRU-ordered and capped.

import { z } from "zod";

import { readDeviceStore, writeDeviceStore } from "@/lib/device-store";

const STORAGE_KEY = "nour.player.recent";
const MAX_ENTRIES = 20;

const recentTrackSchema = z.object({
  trackId: z.string(),
  title: z.string(),
  coverUrl: z.string().optional(),
  playlistTitle: z.string().optional(),
  playlistSlug: z.string().optional(),
  locale: z.string().optional(),
  // Total track duration in seconds — populated from DB or audio metadata.
  // Absent on entries recorded before this field was added; shelf skips the
  // progress bar when missing.
  duration: z.number().optional(),
  updatedAt: z.number(),
});
export type RecentTrack = z.infer<typeof recentTrackSchema>;

export function readRecentlyPlayed(): RecentTrack[] {
  return readDeviceStore(STORAGE_KEY, z.array(recentTrackSchema), []);
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
  writeDeviceStore(STORAGE_KEY, next);
  return next;
}

export function clearRecentlyPlayed(): void {
  writeDeviceStore(STORAGE_KEY, []);
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
