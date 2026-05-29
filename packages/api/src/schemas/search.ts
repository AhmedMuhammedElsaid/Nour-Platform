import { z } from "zod";

/*
 * Search DTOs. Hits are already locale-resolved by the service so the web
 * layer renders them directly. Track hits carry their parent playlist so the
 * UI can link back to a playable page.
 */

export type PlaylistSearchHit = {
  id: string;
  title: string;
  slug: string;
  coverMediaId?: string;
};

export type TrackSearchHit = {
  id: string;
  title: string;
  playlistId: string;
  playlistSlug: string;
  playlistTitle: string;
};

export type SearchResult = {
  playlists: PlaylistSearchHit[];
  tracks: TrackSearchHit[];
};

// Request-boundary validation: trimmed, non-empty, bounded length.
export const searchQuerySchema = z.string().trim().min(1).max(100);
