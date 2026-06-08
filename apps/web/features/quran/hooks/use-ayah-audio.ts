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

export function useAyahAudio(ayahs: PlayableAyah[]): UseAyahAudio {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentGlobal, setCurrentGlobal] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatAyah, setRepeatAyah] = useState(false);

  // Lazily create a single audio element (client only).
  if (audioRef.current === null && typeof window !== "undefined") {
    audioRef.current = new Audio();
  }

  const indexByGlobal = useMemo(
    () => new Map(ayahs.map((a, i) => [a.numberGlobal, i])),
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
      setCurrentGlobal(ayah.numberGlobal);
      setIsPlaying(true);
      // Surface playback rejections (CSP block, network error, autoplay
      // policy) so a silent failure is diagnosable in the console.
      el.play().catch((err) => {
        console.warn("ayah audio play failed", ayah.audioUrl, err);
        setIsPlaying(false);
        setCurrentGlobal(null);
      });
    },
    [ayahs],
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
