"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface PlayableAyah {
  numberGlobal: number;
  audioUrl: string | null;
}

export interface UseAyahAudio {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  currentGlobal: number | null;
  isPlaying: boolean;
  repeatAyah: boolean;
  setRepeatAyah: (v: boolean) => void;
  playAyah: (numberGlobal: number) => void;
  toggle: () => void;
  stop: () => void;
}

export interface UseAyahAudioOptions {
  // Invoked right before any ayah playback starts or resumes. The reader uses
  // this to pause the site-wide PlayerProvider — the two audio engines are
  // independent HTMLAudioElements and would otherwise play over each other.
  onPlaybackStart?: () => void;
}

// Warm the browser HTTP cache (and our cross-origin audio service worker
// cache) for one URL without playing it. Using fetch() with the audio
// destination doesn't exist, so we trigger a parallel <audio> load.
function prefetchUrl(el: HTMLAudioElement, url: string): void {
  // Setting src to the same URL is a no-op; guard so we don't restart loads.
  if (el.src === url) return;
  el.src = url;
  // load() initiates the download but doesn't play; the SW intercepts it and
  // populates AUDIO_CACHE so the next play() resolves from cache instantly.
  el.load();
}

export function useAyahAudio(
  ayahs: PlayableAyah[],
  opts?: UseAyahAudioOptions,
): UseAyahAudio {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Latest-callback ref so a per-render inline callback doesn't churn the
  // memoized playAt/toggle below.
  const onPlaybackStartRef = useRef(opts?.onPlaybackStart);
  useEffect(() => {
    onPlaybackStartRef.current = opts?.onPlaybackStart;
  });
  // Hidden secondary element used purely to warm the cache for the next ayah
  // while the primary one is playing. Browsers happily run two loads in
  // parallel — this is the standard podcast/audio-app pattern.
  const prefetchRef = useRef<HTMLAudioElement | null>(null);
  const [currentGlobal, setCurrentGlobal] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatAyah, setRepeatAyah] = useState(false);

  // Lazily create both audio elements (client only).
  if (audioRef.current === null && typeof window !== "undefined") {
    const main = new Audio();
    // Eagerly fetch metadata + buffer so the first play() is responsive; the
    // browser still honors a user gesture for the actual playback start.
    main.preload = "auto";
    main.crossOrigin = "anonymous";
    audioRef.current = main;

    const pre = new Audio();
    pre.preload = "auto";
    pre.crossOrigin = "anonymous";
    prefetchRef.current = pre;
  }

  const indexByGlobal = useMemo(
    () => new Map(ayahs.map((a, i) => [a.numberGlobal, i])),
    [ayahs],
  );

  // Warm the cache for the ayah after `index`, if one exists with a URL.
  const warmNext = useCallback(
    (index: number) => {
      const pre = prefetchRef.current;
      if (!pre) return;
      const next = ayahs[index + 1];
      if (!next?.audioUrl) return;
      prefetchUrl(pre, next.audioUrl);
    },
    [ayahs],
  );

  const playAt = useCallback(
    (index: number) => {
      const el = audioRef.current;
      const ayah = ayahs[index];
      if (!el || !ayah || !ayah.audioUrl) {
        setCurrentGlobal(null);
        setIsPlaying(false);
        return;
      }
      el.src = ayah.audioUrl;
      onPlaybackStartRef.current?.();
      setCurrentGlobal(ayah.numberGlobal);
      setIsPlaying(true);
      // Surface playback rejections (CSP block, network error, autoplay
      // policy) so a silent failure is diagnosable in the console.
      el.play().catch((err) => {
        console.warn("ayah audio play failed", ayah.audioUrl, err);
        setIsPlaying(false);
        setCurrentGlobal(null);
      });
      // Kick off the prefetch for the *next* ayah so auto-advance is instant.
      warmNext(index);
    },
    [ayahs, warmNext],
  );

  const playAyah = useCallback(
    (numberGlobal: number) => {
      const idx = indexByGlobal.get(numberGlobal);
      if (idx === undefined) return;
      playAt(idx);
    },
    [indexByGlobal, playAt],
  );

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
    setCurrentGlobal(null);
  }, []);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else if (currentGlobal !== null) {
      onPlaybackStartRef.current?.();
      void el.play();
      setIsPlaying(true);
    }
  }, [isPlaying, currentGlobal]);

  // Auto-advance / repeat when the current ayah's audio ends.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => {
      if (currentGlobal === null) return;
      if (repeatAyah) {
        playAyah(currentGlobal);
        return;
      }
      const idx = indexByGlobal.get(currentGlobal);
      if (idx === undefined) return;
      const nextIdx = idx + 1;
      if (nextIdx >= ayahs.length) {
        setIsPlaying(false);
        setCurrentGlobal(null);
        return;
      }
      playAt(nextIdx);
    };
    el.addEventListener("ended", onEnded);
    return () => el.removeEventListener("ended", onEnded);
  }, [currentGlobal, repeatAyah, ayahs.length, indexByGlobal, playAt, playAyah]);

  return {
    audioRef,
    currentGlobal,
    isPlaying,
    repeatAyah,
    setRepeatAyah,
    playAyah,
    toggle,
    stop,
  };
}
