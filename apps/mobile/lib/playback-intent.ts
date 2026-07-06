// Shared "does the user currently want playback" flag. Written by both
// player-context.tsx (JS-driven play/pause/toggle/retry/load/sleep-timer-stop)
// and playback-service.ts (OS lock-screen / notification remote controls), and
// read by player-context's live-stream PlaybackError handler — so a
// user-initiated pause/stop can't be silently resurrected by the live-radio
// auto-retry (a stream connection drop surfaces as a PlaybackError too).
let userWantsPlayback = true;

export function setUserWantsPlayback(next: boolean): void {
  userWantsPlayback = next;
}

export function getUserWantsPlayback(): boolean {
  return userWantsPlayback;
}
