// Pure helpers for giving RNTP a real multi-track native queue instead of the
// old reset()+add(single-track) load-on-demand pattern. Kept free of any RNTP
// import so the ordering math is unit-testable without the native mock — see
// player-context.tsx for how these are wired into the provider.

import type { Track } from "react-native-track-player";
import type { QueueTrack, RepeatMode } from "./player-context";

// How many tracks beyond the currently-playing one RNTP is allowed to see and
// prebuffer. 2 is enough for ExoPlayer's own buffer policy (minBuffer:30 in
// setupPlayer) to have a real head start on ayah/track boundaries without
// keeping a large window of stale native state around.
export const NATIVE_QUEUE_LOOKAHEAD = 2;

// Walks `order` (a permutation of queue indices — see buildPlayOrder) forward
// from wherever `currentIndex` sits, returning up to `count` upcoming queue
// indices. Mirrors the advancement rules PlaybackQueueEnded already applies:
// repeat-one never looks ahead (there IS no "next"), repeat-all wraps back to
// the start, repeat-off stops at the boundary.
export function upcomingIndices(
  order: number[],
  currentIndex: number,
  repeatMode: RepeatMode,
  count: number,
): number[] {
  if (repeatMode === "one" || count <= 0 || order.length === 0) return [];
  const pos = order.indexOf(currentIndex);
  if (pos === -1) return [];

  const result: number[] = [];
  // Bounded by order.length - 1: that's every OTHER position exactly once,
  // so a wrap (repeat-all) can never re-visit the current position or loop
  // forever, and repeat-off naturally stops at the boundary via the break.
  for (let step = 1; step <= order.length - 1 && result.length < count; step += 1) {
    let nextPos = pos + step;
    if (nextPos >= order.length) {
      if (repeatMode !== "all") break;
      nextPos = nextPos % order.length;
    }
    const idx = order[nextPos];
    if (idx !== undefined) result.push(idx);
  }
  return result;
}

// The native Track object for one QueueTrack — same shape currently inlined
// in player-context.tsx's load effect, extracted so both the initial load and
// the lookahead top-up build tracks identically.
export function toNativeTrack(track: QueueTrack, localPath: string | null): Track {
  return {
    id: track.id,
    url: localPath ?? track.mediaUrl,
    title: track.title,
    artist: track.playlistTitle ?? "",
    artwork: track.coverUrl,
    duration: track.durationSecs,
  };
}

// Maps a native RNTP track id (from PlaybackActiveTrackChanged's event.track.id
// / event.lastTrack.id, typed loosely by RNTP as unknown-ish) back to an index
// in our own QueueTrack[] state. IDs are matched as strings since RNTP tracks
// may carry either a string or number id.
export function indexOfTrackId(queue: QueueTrack[], id: unknown): number {
  if (typeof id !== "string" && typeof id !== "number") return -1;
  const target = String(id);
  return queue.findIndex((t) => t.id === target);
}
