"use client";

import { useCallback } from "react";

import { Button } from "@repo/ui/primitives/button";
import { usePlayer } from "@repo/ui/blocks/player-context";
import type { QueueTrack } from "@repo/ui/blocks/player-context";

import type { SerializedPlayableTrack } from "@/features/playlists/types";

interface Props {
  tracks: SerializedPlayableTrack[];
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function toQueueTrack(t: SerializedPlayableTrack): QueueTrack {
  return {
    id: t.id,
    title: t.title,
    mediaUrl: t.srcUrl!,
    durationSecs: t.durationSecs,
  };
}

export function TrackListPlayer({ tracks }: Props) {
  const { loadQueue, currentTrack, isPlaying, toggle } = usePlayer();

  const playableTracks = tracks.filter((t) => t.srcUrl !== null);
  const queueTracks = playableTracks.map(toQueueTrack);

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
        {tracks.map((track, i) => {
          const isCurrent = currentTrack?.id === track.id;
          const canPlay = track.srcUrl !== null;

          return (
            <li
              key={track.id}
              className="flex items-center gap-4 py-3 border-b border-border last:border-0"
              aria-current={isCurrent ? "true" : undefined}
            >
              <button
                type="button"
                disabled={!canPlay}
                onClick={() => handlePlayTrack(track.id)}
                aria-label={
                  isCurrent && isPlaying
                    ? `Pause ${track.title}`
                    : `Play ${track.title}`
                }
                className="w-6 text-right text-sm shrink-0 text-text-2 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                {isCurrent && isPlaying ? "⏸" : i + 1}
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
                  : "—"}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
