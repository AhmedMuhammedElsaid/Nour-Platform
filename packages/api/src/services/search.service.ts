import {
  findPublishedPlaylistsByIds,
  searchPublishedPlaylists,
} from "../repositories/playlist.repo";
import { searchTracks } from "../repositories/track.repo";
import type { Locale } from "../schemas/locale";
import {
  searchQuerySchema,
  type SearchResult,
} from "../schemas/search";

/*
 * Search service — public read (no session). Full-text matches published
 * playlists and tracks, resolves each hit to the requested locale, and links
 * track hits to their published parent playlist. Backed by the text indexes
 * created in migration 0006; never throws on an empty/invalid query (returns
 * empty results — the "filter facets ignore-on-miss" rule in APP_CONTEXT).
 */

const DEFAULT_LIMIT = 20;

export async function searchContent(
  locale: Locale,
  rawQuery: string,
  limit: number = DEFAULT_LIMIT,
): Promise<SearchResult> {
  const parsed = searchQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return { playlists: [], tracks: [] };
  }
  const query = parsed.data;

  const [playlistDocs, trackDocs] = await Promise.all([
    searchPublishedPlaylists(query, limit),
    searchTracks(query, limit),
  ]);

  const playlists = playlistDocs.map((doc) => ({
    id: doc._id.toString(),
    title: doc[locale].title,
    slug: doc[locale].slug,
    ...(doc.coverMediaId != null
      ? { coverMediaId: doc.coverMediaId.toString() }
      : {}),
  }));

  // Resolve each track's parent playlist in one batched fetch. Tracks whose
  // playlist is missing or unpublished are dropped (don't leak draft content).
  const playlistIds = [
    ...new Set(trackDocs.map((t) => t.playlistId.toString())),
  ];
  const parents = await findPublishedPlaylistsByIds(playlistIds);
  const parentById = new Map(parents.map((p) => [p._id.toString(), p]));

  const tracks = trackDocs.flatMap((doc) => {
    const parent = parentById.get(doc.playlistId.toString());
    if (!parent) return [];
    return [
      {
        id: doc._id.toString(),
        title: doc[locale].title,
        playlistId: parent._id.toString(),
        playlistSlug: parent[locale].slug,
        playlistTitle: parent[locale].title,
      },
    ];
  });

  return { playlists, tracks };
}
