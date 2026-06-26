import type { Playlist } from "@repo/shared-core/schemas/playlist";
import type { Track } from "@repo/shared-core/schemas/track";

import { assetUrl, getJson } from "./api";
import type { QueueItem } from "./player-state";
import { get, set, type RecentItem } from "./storage";

const LOCALE = "ar" as const;

type PlayableTrack = Track & { srcUrl: string | null };
type PlaylistDetail = { playlist: Playlist; tracks: PlayableTrack[] };

export type PlaylistSummary = {
  id: string;
  slug: string;
  title: string;
  cover: string | null;
  trackCount: number;
  categoryIds: string[];
  scholar: string | null;
  description: string | null;
};

export type CategorySummary = {
  id: string;
  arSlug: string;
  arName: string;
  enName: string;
};

export type TrackRow = {
  id: string;
  title: string;
  durationSecs: number | null;
  hasAudio: boolean;
};

export type PlaylistDetailData = {
  id: string;
  slug: string;
  title: string;
  cover: string | null;
  scholar: string | null;
  description: string | null;
  categoryIds: string[];
  tracks: TrackRow[];
};

// Shape the server returns for categories (dates are strings after JSON.parse).
type RawCategory = {
  id: string;
  ar: { name: string; slug: string; description?: string };
  en: { name: string; slug: string; description?: string };
  coverMediaId?: string;
  createdAt: string;
  updatedAt: string;
};

export async function fetchCategories(): Promise<CategorySummary[]> {
  const list = await getJson<RawCategory[]>("/categories");
  return list.map((c) => ({
    id: c.id,
    arSlug: c.ar.slug,
    arName: c.ar.name,
    enName: c.en.name,
  }));
}

export async function fetchPlaylists(): Promise<PlaylistSummary[]> {
  const list = await getJson<Playlist[]>("/playlists");
  return list.map((p) => ({
    id: p.id,
    slug: p[LOCALE].slug,
    title: p[LOCALE].title,
    cover: p.scholarImage ? assetUrl(p.scholarImage) : null,
    trackCount: p.trackCount ?? 0,
    categoryIds: p.categoryIds,
    scholar: p[LOCALE].scholarName ?? null,
    description: p[LOCALE].description ?? null,
  }));
}

export async function fetchPlaylistDetail(slug: string): Promise<PlaylistDetailData> {
  const detail = await getJson<PlaylistDetail>(`/playlists/${encodeURIComponent(slug)}`, {
    locale: LOCALE,
  });
  const cover = detail.playlist.scholarImage
    ? assetUrl(detail.playlist.scholarImage)
    : null;
  return {
    id: detail.playlist.id,
    slug: detail.playlist[LOCALE].slug,
    title: detail.playlist[LOCALE].title,
    cover,
    scholar: detail.playlist[LOCALE].scholarName ?? null,
    description: detail.playlist[LOCALE].description ?? null,
    categoryIds: detail.playlist.categoryIds,
    tracks: detail.tracks.map((t) => ({
      id: t.id,
      title: t[LOCALE].title,
      durationSecs: t.durationSecs ?? null,
      hasAudio: t.srcUrl != null,
    })),
  };
}

export async function buildPlaylistQueue(
  slug: string,
): Promise<{ queue: QueueItem[]; recent: RecentItem }> {
  const detail = await getJson<PlaylistDetail>(`/playlists/${encodeURIComponent(slug)}`, {
    locale: LOCALE,
  });
  const cover = detail.playlist.scholarImage
    ? assetUrl(detail.playlist.scholarImage)
    : undefined;
  const playlistSlug = detail.playlist[LOCALE].slug;

  const queue: QueueItem[] = detail.tracks.flatMap((t) =>
    t.srcUrl
      ? [
          {
            id: t.id,
            url: t.srcUrl,
            title: t[LOCALE].title,
            artist: detail.playlist[LOCALE].title,
            artwork: cover,
            slug: playlistSlug,
            durationSecs: t.durationSecs,
          },
        ]
      : [],
  );

  return {
    queue,
    recent: {
      slug: playlistSlug,
      title: detail.playlist[LOCALE].title,
      type: "playlist",
      cover,
    },
  };
}

export async function recordRecent(item: RecentItem): Promise<void> {
  const list = await get("nour.player.recent");
  const next = [item, ...list.filter((r) => r.slug !== item.slug)].slice(0, 20);
  await set("nour.player.recent", next);
}
