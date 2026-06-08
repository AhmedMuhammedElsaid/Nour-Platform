// RNTP playback service — registered once at app startup. Runs in the
// background (Android foreground service / iOS audio session). All heavy
// logic (shuffle, repeat, sleep) lives in player-context.tsx; this file
// only wires the OS transport events to TrackPlayer's imperative API.

import TrackPlayer, { Event } from "react-native-track-player";

export async function playbackService(): Promise<void> {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    void TrackPlayer.play();
  });
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    void TrackPlayer.pause();
  });
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    void TrackPlayer.stop();
  });
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    void TrackPlayer.skipToNext();
  });
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    void TrackPlayer.skipToPrevious();
  });
  TrackPlayer.addEventListener(Event.RemoteSeek, (e) => {
    void TrackPlayer.seekTo(e.position);
  });
  TrackPlayer.addEventListener(Event.RemoteJumpForward, (e) => {
    void TrackPlayer.getProgress().then((p) => {
      void TrackPlayer.seekTo(p.position + (e.interval ?? 10));
    });
  });
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, (e) => {
    void TrackPlayer.getProgress().then((p) => {
      void TrackPlayer.seekTo(Math.max(0, p.position - (e.interval ?? 10)));
    });
  });
}
