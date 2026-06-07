"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

import type { AdhanPrayerKey } from "@repo/api/schemas/prayer-times";

const REGULAR_SRC = "/audio/adhan.mp3";
const FAJR_SRC = "/audio/adhan-fajr.mp3";

export type AdhanPlayerHandle = {
  // Play the adhan for `key` at the given volume (0..1). Returns the audio
  // element's play() promise so callers can detect autoplay-block rejection.
  play: (key: AdhanPrayerKey, volume: number) => Promise<void>;
  // Prime both elements during a user gesture so later timed playback is
  // allowed by the browser autoplay policy (load() counts as the gesture).
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

  useImperativeHandle(ref, () => ({
    play: async (key, volume) => {
      const el = key === "fajr" ? fajrRef.current : regularRef.current;
      if (!el) return;
      el.volume = Math.min(1, Math.max(0, volume));
      el.currentTime = 0;
      await el.play();
    },
    unlock: () => {
      for (const el of [regularRef.current, fajrRef.current]) {
        // load() during a user gesture marks the element as user-activated
        // without making sound, so the scheduled play() later won't be blocked.
        el?.load();
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
