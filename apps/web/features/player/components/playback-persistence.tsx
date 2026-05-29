"use client";

import { useEffect, useRef } from "react";

import { usePlayer } from "@repo/ui/blocks/player-context";

import { recordRecentlyPlayed } from "@/features/player/lib/recently-played";

// Headless island: subscribes to the player and records each distinct track
// into the device-local "recently played" history (homepage shelf). Mounted
// inside PlayerProvider so the generic player block stays app-agnostic.
export function PlaybackPersistence() {
  const { currentTrack, duration } = usePlayer();
  const lastRecordedRef = useRef<string | null>(null);

  // Record the track as soon as it loads. `durationSecs` from the DB is
  // included when available so the Continue Listening shelf can show a
  // progress bar immediately.
  useEffect(() => {
    if (!currentTrack) return;
    if (lastRecordedRef.current === currentTrack.id) return;
    lastRecordedRef.current = currentTrack.id;
    recordRecentlyPlayed({
      trackId: currentTrack.id,
      title: currentTrack.title,
      coverUrl: currentTrack.coverUrl,
      playlistTitle: currentTrack.playlistTitle,
      playlistSlug: currentTrack.playlistSlug,
      locale: currentTrack.locale,
      duration: currentTrack.durationSecs,
    });
  }, [currentTrack]);

  // Back-fill duration once the audio element reports it. This covers tracks
  // where `durationSecs` was absent from the DB record. `duration` from
  // context is set in `onDurationChange` (not on every timeupdate tick), so
  // this effect fires at most twice per track.
  useEffect(() => {
    const track = currentTrack;
    if (!track || duration <= 0) return;
    recordRecentlyPlayed({
      trackId: track.id,
      title: track.title,
      coverUrl: track.coverUrl,
      playlistTitle: track.playlistTitle,
      playlistSlug: track.playlistSlug,
      locale: track.locale,
      duration,
    });
  }, [currentTrack, duration]);

  return null;
}
