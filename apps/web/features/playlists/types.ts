import type { Playlist } from "@repo/api/schemas/playlist";
import type { Track } from "@repo/api/schemas/track";
import type { PlayableTrack } from "@repo/api/services/track";

/*
 * SerializedPlaylist replaces Date fields with ISO strings so the DTO is
 * safe to pass across the RSC → client component boundary (Dates are not
 * JSON-serializable in Next.js RSC serialization).
 */
export type SerializedPlaylist = Omit<Playlist, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

/*
 * SerializedTrack mirrors SerializedPlaylist: Date fields replaced with ISO
 * strings for safe RSC → client boundary crossing.
 */
export type SerializedTrack = Omit<Track, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

/*
 * SerializedPlayableTrack extends SerializedTrack with a resolved media URL
 * for the audio player. srcUrl is null when R2_PUBLIC_BASE is not configured
 * or the media record has no key.
 */
export type SerializedPlayableTrack = Omit<
  PlayableTrack,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};
