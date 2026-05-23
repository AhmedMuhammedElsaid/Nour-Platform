"use client";

import * as React from "react";

export type QueueTrack = {
  id: string;
  title: string;
  mediaUrl: string;
  durationSecs?: number;
};

export type PlayerContextValue = {
  queue: QueueTrack[];
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  hasQueue: boolean;
  currentTrack: QueueTrack | null;
  loadQueue: (tracks: QueueTrack[], startIndex?: number) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  next: () => void;
  prev: () => void;
};

const PlayerContext = React.createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const ctx = React.useContext(PlayerContext);
  if (!ctx) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return ctx;
}

type PlayerProviderProps = {
  children: React.ReactNode;
};

export function PlayerProvider({ children }: PlayerProviderProps) {
  // Single audio element ref owned by the provider. Created lazily on the
  // client only — server render returns null so SSR stays inert.
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  if (audioRef.current === null && typeof window !== "undefined") {
    audioRef.current = new Audio();
    audioRef.current.preload = "metadata";
  }

  const [queue, setQueue] = React.useState<QueueTrack[]>([]);
  const [currentIndex, setCurrentIndex] = React.useState<number>(-1);
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
  const [currentTime, setCurrentTime] = React.useState<number>(0);
  const [duration, setDuration] = React.useState<number>(0);

  // Tracks any user gesture in the session. Mobile Safari forbids autoplay
  // and autoplay-next until the user has interacted with the page at least
  // once; this flag is the gate.
  const hasInteractedRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    const markInteracted = (): void => {
      hasInteractedRef.current = true;
    };
    window.addEventListener("pointerdown", markInteracted, { once: true });
    window.addEventListener("keydown", markInteracted, { once: true });
    return () => {
      window.removeEventListener("pointerdown", markInteracted);
      window.removeEventListener("keydown", markInteracted);
    };
  }, []);

  // Wire audio element lifecycle events. The element is stable across the
  // provider's lifetime so we only attach listeners once.
  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = (): void => setCurrentTime(audio.currentTime);
    const onDurationChange = (): void => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const onPlay = (): void => setIsPlaying(true);
    const onPause = (): void => setIsPlaying(false);
    const onEnded = (): void => {
      setIsPlaying(false);
      // Auto-advance only after a prior user gesture this session; mobile
      // Safari would otherwise block the play() call and leave us paused.
      if (!hasInteractedRef.current) return;
      setCurrentIndex((idx) => {
        if (idx < 0) return idx;
        const nextIdx = idx + 1;
        // Bound at the last track. Component-level effect handles src swap.
        return nextIdx;
      });
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("loadedmetadata", onDurationChange);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("loadedmetadata", onDurationChange);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  // When currentIndex changes, swap the audio src and (optionally) autoplay.
  // Autoplay only fires when there has been a prior user gesture — keeps
  // mobile Safari happy and avoids surprising the user on first load.
  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (currentIndex < 0 || currentIndex >= queue.length) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      setCurrentTime(0);
      setDuration(0);
      return;
    }
    const track = queue[currentIndex];
    if (!track) return;
    if (audio.src !== track.mediaUrl) {
      audio.src = track.mediaUrl;
      audio.load();
      setCurrentTime(0);
      setDuration(track.durationSecs ?? 0);
    }
    if (hasInteractedRef.current) {
      void audio.play().catch(() => {
        // Browsers may still reject (e.g. silent mode); swallow rather than
        // crash. UI stays in paused state via the `pause` event listener.
      });
    }
  }, [currentIndex, queue]);

  const loadQueue = React.useCallback(
    (tracks: QueueTrack[], startIndex: number = 0): void => {
      setQueue(tracks);
      const safeIndex =
        tracks.length === 0
          ? -1
          : Math.min(Math.max(startIndex, 0), tracks.length - 1);
      setCurrentIndex(safeIndex);
    },
    [],
  );

  const play = React.useCallback((): void => {
    const audio = audioRef.current;
    if (!audio) return;
    hasInteractedRef.current = true;
    void audio.play().catch(() => {
      /* see note above */
    });
  }, []);

  const pause = React.useCallback((): void => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
  }, []);

  const toggle = React.useCallback((): void => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      hasInteractedRef.current = true;
      void audio.play().catch(() => {
        /* see note above */
      });
    } else {
      audio.pause();
    }
  }, []);

  const seek = React.useCallback((seconds: number): void => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.max(
      0,
      Number.isFinite(audio.duration) ? Math.min(seconds, audio.duration) : seconds,
    );
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  const next = React.useCallback((): void => {
    setCurrentIndex((idx) => {
      if (idx < 0) return idx;
      const nextIdx = idx + 1;
      return nextIdx >= queue.length ? idx : nextIdx;
    });
  }, [queue.length]);

  const prev = React.useCallback((): void => {
    setCurrentIndex((idx) => {
      if (idx <= 0) return idx;
      return idx - 1;
    });
  }, []);

  const hasQueue = queue.length > 0 && currentIndex >= 0;
  const currentTrack: QueueTrack | null =
    currentIndex >= 0 && currentIndex < queue.length
      ? (queue[currentIndex] ?? null)
      : null;

  const value = React.useMemo<PlayerContextValue>(
    () => ({
      queue,
      currentIndex,
      isPlaying,
      currentTime,
      duration,
      hasQueue,
      currentTrack,
      loadQueue,
      play,
      pause,
      toggle,
      seek,
      next,
      prev,
    }),
    [
      queue,
      currentIndex,
      isPlaying,
      currentTime,
      duration,
      hasQueue,
      currentTrack,
      loadQueue,
      play,
      pause,
      toggle,
      seek,
      next,
      prev,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}
