"use client";

import { useEffect, useRef } from "react";

import { usePlayer } from "@repo/ui/blocks/player-context";

import { recordRecentlyPlayed } from "@/features/player/lib/recently-played";

// Headless island: subscribes to the player and records each distinct track
// into the device-local "recently played" history (homepage shelf). Mounted
// inside PlayerProvider so the generic player block stays app-agnostic.
export function PlaybackPersistence() {
  const { currentTrack } = usePlayer();
  const lastRecordedRef = useRef<string | null>(null);

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
    });
  }, [currentTrack]);

  return null;
}
