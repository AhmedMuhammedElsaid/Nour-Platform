import type { Playlist } from "@repo/shared-core/schemas/playlist";
import type { Track } from "@repo/shared-core/schemas/track";

// The /api/v1 layer serializes Dates to ISO strings. The shared-core schemas
// type those fields as `Date`; at the HTTP boundary they arrive as strings.
// We don't read createdAt/updatedAt on these screens, so we leave the schema
// types as-is rather than threading a serialized variant everywhere.

// A track enriched with a resolved playable URL (added by getTracksWithUrls on
// the server; not part of the pure Track schema).
export type PlayableTrack = Track & { srcUrl: string | null };

// Shape of GET /api/v1/playlists/:slug.
export type PlaylistDetailResponse = {
  playlist: Playlist;
  tracks: PlayableTrack[];
};

// A resolved category label for card chips / detail header.
export type CategoryChip = { slug: string; name: string };
