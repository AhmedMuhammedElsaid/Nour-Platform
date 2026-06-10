"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

import type { AdhanPrayerKey } from "@repo/api/schemas/prayer-times";

const REGULAR_SRC = "/audio/adhan.mp3";
const FAJR_SRC = "/audio/adhan-fajr.mp3";

export type AdhanPlayerHandle = {
  // Play the adhan for `key` at the given volume (0..1). Returns the audio
  // element's play() promise so callers can detect autoplay-block rejection.
  play: (key: AdhanPrayerKey, volume: number) => Promise<void>;
  // Prime both elements during a user gesture (silent muted play/pause) so a
  // later timed playback is allowed by the browser autoplay policy.
  unlock: () => void;
};

// Two <audio> elements (regular + Fajr) kept mounted; Fajr has the extra
// "as-salatu khayrun min an-nawm" line so it must be a separate recording.
export const AdhanPlayer = forwardRef<AdhanPlayerHandle>(function AdhanPlayer(
  _props,
  ref,
) {
  const regularRef = useRef<HTMLAudioElement>(null);
  const fajrRef = useRef<HTMLAudioElement>(null);
  const unlockedRef = useRef(false);

  useImperativeHandle(ref, () => ({
    play: async (key, volume) => {
      const el = key === "fajr" ? fajrRef.current : regularRef.current;
      const sibling = key === "fajr" ? regularRef.current : fajrRef.current;
      // Only one adhan may sound at a time, whatever triggered each play —
      // silence the other recording before starting this one.
      if (sibling && !sibling.paused) {
        sibling.pause();
        sibling.currentTime = 0;
      }
      if (!el) return;
      el.volume = Math.min(1, Math.max(0, volume));
      el.currentTime = 0;
      await el.play();
    },
    unlock: () => {
      // load() alone does NOT satisfy the autoplay policy — only a play()
      // invoked inside a user gesture grants the element the sticky activation
      // that lets a later *timed* play() (no gesture) run. Prime each element
      // with a muted play()/pause() so it's silent but unlocked.
      // Runs once: a repeat unlock (remount, test button) must not re-prime —
      // its pause()/currentTime reset would cut off an adhan already sounding.
      if (unlockedRef.current) return;
      unlockedRef.current = true;
      for (const el of [regularRef.current, fajrRef.current]) {
        // Never prime an element that is actively playing: it's mid-adhan
        // (autoplay was evidently allowed) and muting/pausing would kill it.
        if (!el || !el.paused) continue;
        const wasMuted = el.muted;
        el.muted = true;
        el.play()
          .then(() => {
            el.pause();
            el.currentTime = 0;
            el.muted = wasMuted;
          })
          .catch(() => {
            el.muted = wasMuted;
          });
      }
    },
  }));

  return (
    <>
      <audio ref={regularRef} src={REGULAR_SRC} preload="none" hidden />
      <audio ref={fajrRef} src={FAJR_SRC} preload="none" hidden />
    </>
  );
});
