import type { Playlist } from "@repo/shared-core/schemas/playlist";
import type { Track } from "@repo/shared-core/schemas/track";

import { assetUrl, getJson } from "./api";
import type { QueueItem } from "./player-state";
import { get, set, type RecentItem } from "./storage";

// The extension surfaces Arabic content (the platform's default locale).
const LOCALE = "ar" as const;

// A track enriched with a resolved playable URL by the server (getTracksWithUrls).
type PlayableTrack = Track & { srcUrl: string | null };
type PlaylistDetail = { playlist: Playlist; tracks: PlayableTrack[] };

export type PlaylistSummary = {
  slug: string;
  title: string;
  cover: string | null;
  trackCount: number;
};

// Lists published playlists for the new-tab library.
export async function fetchPlaylists(): Promise<PlaylistSummary[]> {
  const list = await getJson<Playlist[]>("/playlists");
  return list.map((p) => ({
    slug: p[LOCALE].slug,
    title: p[LOCALE].title,
    cover: p.scholarImage ? assetUrl(p.scholarImage) : null,
    trackCount: p.trackCount ?? 0,
  }));
}

// Fetches a playlist and maps its tracks into a player queue. Tracks without a
// resolved URL are dropped (a missing/unconfirmed media file can't play).
export async function buildPlaylistQueue(
  slug: string,
): Promise<{ queue: QueueItem[]; recent: RecentItem }> {
  const detail = await getJson<PlaylistDetail>(`/playlists/${encodeURIComponent(slug)}`, {
    locale: LOCALE,
  });
  const cover = detail.playlist.scholarImage
    ? assetUrl(detail.playlist.scholarImage)
    : undefined;

  const queue: QueueItem[] = detail.tracks.flatMap((t) =>
    t.srcUrl
      ? [
          {
            id: t.id,
            url: t.srcUrl,
            title: t[LOCALE].title,
            artist: detail.playlist[LOCALE].title,
            artwork: cover,
          },
        ]
      : [],
  );

  return {
    queue,
    recent: { slug, title: detail.playlist[LOCALE].title, type: "playlist" },
  };
}

// Pushes a played item to the front of the MRU recent list (deduped, capped 20).
export async function recordRecent(item: RecentItem): Promise<void> {
  const list = await get("nour.player.recent");
  const next = [item, ...list.filter((r) => r.slug !== item.slug)].slice(0, 20);
  await set("nour.player.recent", next);
}
