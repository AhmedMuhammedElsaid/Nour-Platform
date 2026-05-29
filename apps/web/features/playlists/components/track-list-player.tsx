"use client";

import { useCallback } from "react";

import { Button } from "@repo/ui/primitives/button";
import { usePlayer } from "@repo/ui/blocks/player-context";
import type { QueueTrack } from "@repo/ui/blocks/player-context";

import type { DisplayTrack } from "@/features/playlists/types";

interface Props {
  tracks: DisplayTrack[];
  playlistTitle?: string;
  coverUrl?: string;
  playlistSlug?: string;
  locale?: string;
}

function formatDuration(secs: number): string {
  const total = Math.round(secs);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function toQueueTrack(
  t: DisplayTrack,
  meta: {
    playlistTitle?: string;
    coverUrl?: string;
    playlistSlug?: string;
    locale?: string;
  },
): QueueTrack {
  return {
    id: t.id,
    title: t.title,
    mediaUrl: t.srcUrl!,
    durationSecs: t.durationSecs,
    playlistTitle: meta.playlistTitle,
    coverUrl: meta.coverUrl,
    playlistSlug: meta.playlistSlug,
    locale: meta.locale,
  };
}

export function TrackListPlayer({
  tracks,
  playlistTitle,
  coverUrl,
  playlistSlug,
  locale,
}: Props) {
  const { loadQueue, currentTrack, isPlaying, toggle } = usePlayer();

  const playableTracks = tracks.filter((t) => t.srcUrl !== null);
  const queueTracks = playableTracks.map((t) =>
    toQueueTrack(t, { playlistTitle, coverUrl, playlistSlug, locale }),
  );

  const handlePlayAll = useCallback(() => {
    if (queueTracks.length > 0) loadQueue(queueTracks, 0);
  }, [queueTracks, loadQueue]);

  const handlePlayTrack = useCallback(
    (trackId: string) => {
      const isAlreadyCurrent = currentTrack?.id === trackId;
      if (isAlreadyCurrent) {
        toggle();
        return;
      }
      const idx = playableTracks.findIndex((t) => t.id === trackId);
      if (idx !== -1) loadQueue(queueTracks, idx);
    },
    [currentTrack, toggle, playableTracks, queueTracks, loadQueue],
  );

  if (tracks.length === 0) {
    return <p className="text-text-2">No tracks yet.</p>;
  }

  return (
    <div>
      {queueTracks.length > 0 && (
        <Button
          variant="default"
          size="sm"
          className="mb-4"
          onClick={handlePlayAll}
        >
          ▶ Play all
        </Button>
      )}

      <ol aria-label="Tracks">
        {tracks.map((track) => {
          const isCurrent = currentTrack?.id === track.id;
          const canPlay = track.srcUrl !== null;

          return (
            <li
              key={track.id}
              className="flex items-center gap-4 py-3 border-b border-border last:border-0"
              aria-current={isCurrent ? "true" : undefined}
              onClick={() => handlePlayTrack(track.id)}
            >
              <button
                type="button"
                disabled={!canPlay}
                aria-label={
                  isCurrent && isPlaying
                    ? `Pause ${track.title}`
                    : `Play ${track.title}`
                }
                className="w-6 text-end text-sm shrink-0 text-text-2 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                {isCurrent && isPlaying ? "⏸" : "▶"}
              </button>
              <span
                className={
                  isCurrent
                    ? "flex-1 font-medium text-primary"
                    : "flex-1 font-medium"
                }
              >
                {track.title}
              </span>
              <span className="text-sm text-text-2 shrink-0">
                {track.durationSecs != null
                  ? formatDuration(track.durationSecs)
                  : "_"}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
