import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Reader-scoped ayah audio — a pool of HTMLAudioElements independent of the
// offscreen player (the two must never play together; the reader pauses the
// offscreen player via onPlaybackStart). Ported from the web use-ayah-audio —
// keep this file a near-identical sibling of it; the only intentional
// differences are: no `crossOrigin` (the new-tab page plays everyayah.com
// audio directly; no CORS/service-worker caching here, unlike web's SW
// AUDIO_CACHE), a quieter play-failure `.catch` (no console.warn), and the
// unmount-cleanup effect below (web has no reader-unmount lifecycle to hook).
// A pool of POOL_SIZE elements is warmed ahead of the currently-playing one
// so auto-advance hands off to an already-buffered element instead of
// re-src-ing/reloading — see warmAhead/playAt for the algorithm, identical to
// web's.

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

// Elements warmed ahead of the currently-playing one. 2 is enough to keep
// well ahead of a short ayah on a slow connection without ballooning
// concurrent connections / resident buffered audio (~145 KB/ayah).
const PREFETCH_COUNT = 2;
// Total pool size: the actively-playing element plus PREFETCH_COUNT warming
// ahead. play() hands off to whichever pool element is already warmed for
// the target URL instead of re-src-ing/reloading a fixed "main" element —
// that redundant reload is the last bit of the race this file exists to
// close (extension has no SW cache backstop, unlike web, so this matters
// even more here).
const POOL_SIZE = PREFETCH_COUNT + 1;

// Warm the browser HTTP disk cache for one URL without playing it.
function prefetchUrl(el: HTMLAudioElement, url: string): void {
  // Setting src to the same URL is a no-op; guard so we don't restart loads.
  if (el.src === url) return;
  el.src = url;
  el.load();
}

// Pure: the next up-to-`count` non-null audio URLs after `index`. Identical
// to web's — kept in sync so the two hooks stay near-identical siblings.
export function lookaheadUrls(
  ayahs: PlayableAyah[],
  index: number,
  count: number,
): string[] {
  const urls: string[] = [];
  for (let i = index + 1; i < ayahs.length && urls.length < count; i += 1) {
    const url = ayahs[i]?.audioUrl;
    if (url) urls.push(url);
  }
  return urls;
}

export function useAyahAudio(
  ayahs: PlayableAyah[],
  opts?: { onPlaybackStart?: () => void },
): UseAyahAudio {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onPlaybackStartRef = useRef(opts?.onPlaybackStart);
  useEffect(() => {
    onPlaybackStartRef.current = opts?.onPlaybackStart;
  });

  // Pool of POOL_SIZE elements. Exactly one is "active" at a time — the one
  // `audioRef.current` points at — the rest sit warming upcoming ayahs.
  const poolRef = useRef<HTMLAudioElement[]>([]);

  const [currentGlobal, setCurrentGlobal] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatAyah, setRepeatAyah] = useState(false);

  // Lazily create the pool (client only). audioRef starts pointed at pool[0]
  // — which element is "active" changes over time via playAt's handoff below.
  if (audioRef.current === null && typeof window !== "undefined") {
    poolRef.current = Array.from({ length: POOL_SIZE }, () => {
      const el = new Audio();
      el.preload = "auto";
      return el;
    });
    audioRef.current = poolRef.current[0] ?? null;
  }

  // Stop playback when the reader unmounts (route change) so audio never
  // leaks — pauses every pool element, not just the active one.
  useEffect(() => {
    return () => {
      poolRef.current.forEach((el) => el.pause());
    };
  }, []);

  const indexByGlobal = useMemo(
    () => new Map(ayahs.map((a, i) => [a.numberGlobal, i])),
    [ayahs],
  );

  // Warm the non-active pool elements with the next PREFETCH_COUNT ayahs'
  // URLs. An element that already holds a still-needed URL is left alone
  // (never restarts an in-flight/completed load); only elements holding
  // something no longer needed get reassigned to whatever's still missing.
  const warmAhead = useCallback(
    (index: number, active: HTMLAudioElement) => {
      const others = poolRef.current.filter((el) => el !== active);
      const urls = lookaheadUrls(ayahs, index, others.length);
      const stillNeeded = urls.filter((url) => !others.some((el) => el.src === url));
      const reusable = others.filter((el) => !urls.includes(el.src));
      stillNeeded.forEach((url, i) => {
        const el = reusable[i];
        if (el) prefetchUrl(el, url);
      });
    },
    [ayahs],
  );

  const playAt = useCallback(
    (index: number) => {
      const ayah = ayahs[index];
      const pool = poolRef.current;
      if (!ayah || !ayah.audioUrl || pool.length === 0) {
        setCurrentGlobal(null);
        setIsPlaying(false);
        return;
      }
      const previouslyActive = audioRef.current;
      // Hand off to whichever pool element is already warmed for this URL
      // (the common auto-advance case); otherwise reuse any non-active
      // element (repeat-ayah replays the SAME element, since it's already
      // "previouslyActive" and already holds the matching src).
      const chosen =
        pool.find((el) => el.src === ayah.audioUrl) ??
        pool.find((el) => el !== previouslyActive) ??
        pool[0]!;
      if (chosen !== previouslyActive) {
        previouslyActive?.pause();
        audioRef.current = chosen;
      }
      // No-op via prefetchUrl's own guard when `chosen` already holds this URL.
      prefetchUrl(chosen, ayah.audioUrl);
      // Repeat-ayah replays the same (already-active) element — rewind it.
      chosen.currentTime = 0;
      onPlaybackStartRef.current?.();
      setCurrentGlobal(ayah.numberGlobal);
      setIsPlaying(true);
      chosen.play().catch(() => {
        setIsPlaying(false);
        setCurrentGlobal(null);
      });
      // Kick off the prefetch for the upcoming ayahs so auto-advance is instant.
      warmAhead(index, chosen);
    },
    [ayahs, warmAhead],
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
    // Pause every pool element, not just the active one — a stale handoff
    // target could otherwise be left mid-buffer/playing in the background.
    poolRef.current.forEach((el) => el.pause());
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

  // Auto-advance / repeat when the current ayah's audio ends. Attached to
  // EVERY pool element (their identity never changes) rather than tracking
  // "whichever one is active right now" — playAt reassigns `audioRef.current`
  // imperatively via a plain ref mutation, which triggers no re-render on its
  // own, so an effect that only listened on `audioRef.current` at attach time
  // could go stale the moment a handoff happens. The `event.target` guard
  // below is what makes listening on all of them safe.
  useEffect(() => {
    const pool = poolRef.current;
    if (pool.length === 0) return;
    const onEnded = (event: Event) => {
      if (event.target !== audioRef.current) return;
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
    pool.forEach((el) => el.addEventListener("ended", onEnded));
    return () => pool.forEach((el) => el.removeEventListener("ended", onEnded));
  }, [currentGlobal, repeatAyah, ayahs.length, indexByGlobal, playAt, playAyah]);

  return { currentGlobal, isPlaying, repeatAyah, setRepeatAyah, playAyah, toggle, stop };
}
