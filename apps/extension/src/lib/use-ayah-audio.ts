import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Reader-scoped ayah audio — a single HTMLAudioElement independent of the
// offscreen player (the two must never play together; the reader pauses the
// offscreen player via onPlaybackStart). Ported from the web use-ayah-audio,
// minus crossOrigin (the extension new-tab plays everyayah.com audio directly;
// no CORS / service-worker caching needed) — keeps a prefetch element so
// auto-advance is instant.

export type PlayableAyah = { numberGlobal: number; audioUrl: string | null };

export type UseAyahAudio = {
  currentGlobal: number | null;
  isPlaying: boolean;
  repeatAyah: boolean;
  setRepeatAyah: (v: boolean) => void;
  playAyah: (numberGlobal: number) => void;
  toggle: () => void;
  stop: () => void;
};

export function useAyahAudio(
  ayahs: PlayableAyah[],
  opts?: { onPlaybackStart?: () => void },
): UseAyahAudio {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prefetchRef = useRef<HTMLAudioElement | null>(null);
  const onPlaybackStartRef = useRef(opts?.onPlaybackStart);
  useEffect(() => {
    onPlaybackStartRef.current = opts?.onPlaybackStart;
  });

  const [currentGlobal, setCurrentGlobal] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatAyah, setRepeatAyah] = useState(false);

  if (audioRef.current === null && typeof window !== "undefined") {
    const main = new Audio();
    main.preload = "auto";
    audioRef.current = main;
    const pre = new Audio();
    pre.preload = "auto";
    prefetchRef.current = pre;
  }

  // Stop playback when the reader unmounts (route change) so audio never leaks.
  useEffect(() => {
    const el = audioRef.current;
    return () => {
      el?.pause();
    };
  }, []);

  const indexByGlobal = useMemo(
    () => new Map(ayahs.map((a, i) => [a.numberGlobal, i])),
    [ayahs],
  );

  const warmNext = useCallback(
    (index: number) => {
      const pre = prefetchRef.current;
      const next = ayahs[index + 1];
      if (!pre || !next?.audioUrl || pre.src === next.audioUrl) return;
      pre.src = next.audioUrl;
      pre.load();
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
      el.play().catch(() => {
        setIsPlaying(false);
        setCurrentGlobal(null);
      });
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

  // Auto-advance / repeat on end.
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

  return { currentGlobal, isPlaying, repeatAyah, setRepeatAyah, playAyah, toggle, stop };
}
