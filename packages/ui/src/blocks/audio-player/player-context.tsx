"use client";

import * as React from "react";

export type QueueTrack = {
  id: string;
  title: string;
  mediaUrl: string;
  durationSecs?: number;
  // Optional now-playing metadata (DESIGN.md §17.1). Cover is a resolved
  // public URL; playlistTitle is the parent playlist's title.
  coverUrl?: string;
  playlistTitle?: string;
  // Optional routing metadata consumed by the web "Continue listening" shelf
  // (recently-played store). Unused by the player itself.
  playlistSlug?: string;
  locale?: string;
  // A live radio stream (infinite duration, no seeking). When set, the player
  // skips resume-position save/restore and the UI shows a LIVE indicator in
  // place of the seek bar. See the radio feature.
  isLive?: boolean;
};

export type RepeatMode = "off" | "all" | "one";

// `null` clears the timer; a number is minutes from now; "end-of-track" pauses
// when the current track finishes.
export type SleepTimerOption = number | "end-of-track" | null;

// Playback speeds surfaced in the player settings UI.
export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;

export type PlayerContextValue = {
  queue: QueueTrack[];
  currentIndex: number;
  isPlaying: boolean;
  isBuffering: boolean;
  errorMessage: string | null;
  currentTime: number;
  duration: number;
  hasQueue: boolean;
  currentTrack: QueueTrack | null;
  repeatMode: RepeatMode;
  isShuffled: boolean;
  playbackRate: number;
  volume: number;
  loadQueue: (tracks: QueueTrack[], startIndex?: number) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  retry: () => void;
  // Stop playback and clear the queue — hides the player bar entirely.
  stop: () => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (vol: number) => void;
  // Epoch ms when a timed sleep timer fires, or null. `sleepAtTrackEnd` is the
  // separate "stop at end of current track" mode.
  sleepTimerEndsAt: number | null;
  sleepAtTrackEnd: boolean;
  setSleepTimer: (option: SleepTimerOption) => void;
};

const PlayerContext = React.createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const ctx = React.useContext(PlayerContext);
  if (!ctx) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return ctx;
}

// Device-local playback preferences (no account — APP_CONTEXT: device-local state).
const PREFS_STORAGE_KEY = "nour.player.prefs";

type PlayerPrefs = {
  playbackRate: number;
  repeatMode: RepeatMode;
  isShuffled: boolean;
  volume: number;
};

function readStoredPrefs(): PlayerPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlayerPrefs>;
    return {
      playbackRate:
        typeof parsed.playbackRate === "number" ? parsed.playbackRate : 1,
      repeatMode:
        parsed.repeatMode === "all" || parsed.repeatMode === "one"
          ? parsed.repeatMode
          : "off",
      isShuffled: Boolean(parsed.isShuffled),
      volume:
        typeof parsed.volume === "number" &&
        parsed.volume >= 0 &&
        parsed.volume <= 1
          ? parsed.volume
          : 1,
    };
  } catch {
    return null;
  }
}

// Device-local resume positions, keyed by track id → last playback second.
const POSITIONS_STORAGE_KEY = "nour.player.positions";
const MAX_STORED_POSITIONS = 100;
// Don't resume the first/last few seconds — restoring those is more annoying
// than useful (you'd rather restart, or it's effectively finished).
const RESUME_MIN_SECONDS = 5;
const RESUME_TAIL_SECONDS = 10;

// Live radio streams intermittently return a 5xx on a cold connection (the
// upstream qurango/icecast mounts do this ~1-in-3); a fresh attempt almost
// always succeeds. Auto-retry this many times (with linear backoff) before
// surfacing a play error, so the user rarely has to press Retry themselves.
const MAX_LIVE_RETRIES = 3;
const LIVE_RETRY_BASE_MS = 800;

type StoredPositions = Record<string, { t: number; at: number }>;

function readPositions(): StoredPositions {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(POSITIONS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as StoredPositions)
      : {};
  } catch {
    return {};
  }
}

function getStoredPosition(trackId: string): number {
  const entry = readPositions()[trackId];
  return entry && typeof entry.t === "number" ? entry.t : 0;
}

function savePosition(trackId: string, seconds: number): void {
  if (typeof window === "undefined") return;
  try {
    const positions = readPositions();
    positions[trackId] = { t: seconds, at: Date.now() };
    // Prune to the most-recently-touched entries to cap storage growth.
    const ids = Object.keys(positions);
    if (ids.length > MAX_STORED_POSITIONS) {
      ids
        .sort((a, b) => (positions[a]?.at ?? 0) - (positions[b]?.at ?? 0))
        .slice(0, ids.length - MAX_STORED_POSITIONS)
        .forEach((id) => delete positions[id]);
    }
    window.localStorage.setItem(
      POSITIONS_STORAGE_KEY,
      JSON.stringify(positions),
    );
  } catch {
    /* storage unavailable — non-fatal */
  }
}

function clearStoredPosition(trackId: string): void {
  if (typeof window === "undefined") return;
  try {
    const positions = readPositions();
    if (positions[trackId]) {
      delete positions[trackId];
      window.localStorage.setItem(
        POSITIONS_STORAGE_KEY,
        JSON.stringify(positions),
      );
    }
  } catch {
    /* non-fatal */
  }
}

// Play order is a sequence of queue indices. Identity when not shuffled; a
// Fisher–Yates permutation otherwise, with the current track pinned to the
// front so toggling shuffle mid-playback never restarts the current track.
function buildPlayOrder(
  length: number,
  shuffled: boolean,
  first: number,
): number[] {
  const order = Array.from({ length }, (_, i) => i);
  if (!shuffled || length <= 1) return order;
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = order[i] as number;
    order[i] = order[j] as number;
    order[j] = tmp;
  }
  if (first >= 0) {
    const pos = order.indexOf(first);
    if (pos > 0) {
      order.splice(pos, 1);
      order.unshift(first);
    }
  }
  return order;
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
  const [isBuffering, setIsBuffering] = React.useState<boolean>(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [currentTime, setCurrentTime] = React.useState<number>(0);
  const [duration, setDuration] = React.useState<number>(0);
  const [repeatMode, setRepeatMode] = React.useState<RepeatMode>("off");
  const [isShuffled, setIsShuffled] = React.useState<boolean>(false);
  const [playbackRate, setPlaybackRateState] = React.useState<number>(1);
  const [volume, setVolumeState] = React.useState<number>(1);
  const [sleepTimerEndsAt, setSleepTimerEndsAt] = React.useState<number | null>(
    null,
  );
  const [sleepAtTrackEnd, setSleepAtTrackEnd] = React.useState<boolean>(false);

  // Refs mirror state so the once-attached audio listeners and the stable
  // navigation callbacks always read fresh values without re-subscribing.
  const repeatModeRef = React.useRef<RepeatMode>(repeatMode);
  const isShuffledRef = React.useRef<boolean>(isShuffled);
  const playbackRateRef = React.useRef<number>(playbackRate);
  const queueRef = React.useRef<QueueTrack[]>(queue);
  const currentIndexRef = React.useRef<number>(currentIndex);
  const playOrderRef = React.useRef<number[]>([]);
  const prefsHydratedRef = React.useRef<boolean>(false);
  // Pending resume offset to apply once the next track's metadata loads.
  const pendingSeekRef = React.useRef<number | null>(null);
  // Throttle resume-position writes (timeupdate fires ~4×/s).
  const lastSaveRef = React.useRef<number>(0);
  // Auto-retry bookkeeping for live streams — count of attempts since the last
  // successful load, plus the pending retry timer (see MAX_LIVE_RETRIES).
  const liveRetryCountRef = React.useRef<number>(0);
  const liveRetryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const sleepTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const sleepAtTrackEndRef = React.useRef<boolean>(false);
  queueRef.current = queue;
  currentIndexRef.current = currentIndex;

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

  // Hydrate device-local prefs once on mount. Done in an effect (not a lazy
  // initializer) to avoid SSR/CSR hydration mismatch — the player is hidden
  // until a queue loads, so the brief default→stored transition isn't visible.
  React.useEffect(() => {
    const prefs = readStoredPrefs();
    if (prefs) {
      setPlaybackRateState(prefs.playbackRate);
      playbackRateRef.current = prefs.playbackRate;
      if (audioRef.current) audioRef.current.playbackRate = prefs.playbackRate;
      setRepeatMode(prefs.repeatMode);
      repeatModeRef.current = prefs.repeatMode;
      setIsShuffled(prefs.isShuffled);
      isShuffledRef.current = prefs.isShuffled;
      setVolumeState(prefs.volume);
      if (audioRef.current) audioRef.current.volume = prefs.volume;
    }
    prefsHydratedRef.current = true;
  }, []);

  // Persist prefs after hydration so the initial default state never clobbers
  // the stored values on first mount.
  React.useEffect(() => {
    if (!prefsHydratedRef.current || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        PREFS_STORAGE_KEY,
        JSON.stringify({ playbackRate, repeatMode, isShuffled, volume }),
      );
    } catch {
      /* storage unavailable (private mode / quota) — non-fatal */
    }
  }, [playbackRate, repeatMode, isShuffled, volume]);

  // Stop and release the audio element when the provider unmounts (e.g. locale
  // switch causes [locale]/layout.tsx to remount, creating a new provider). Without
  // this the detached HTMLAudioElement keeps playing alongside the new one.
  React.useEffect(() => {
    return () => {
      if (liveRetryTimerRef.current) clearTimeout(liveRetryTimerRef.current);
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, []);

  // Advance through the play order by ±1, honoring shuffle order and repeat
  // mode. Stable identity (reads refs) so the once-attached `ended` listener
  // and the transport buttons share one implementation.
  const goRelative = React.useCallback((direction: 1 | -1): void => {
    setCurrentIndex((idx) => {
      const order = playOrderRef.current;
      if (idx < 0 || order.length === 0) return idx;
      const pos = order.indexOf(idx);
      if (pos === -1) return idx;
      let nextPos = pos + direction;
      if (nextPos < 0 || nextPos >= order.length) {
        if (repeatModeRef.current === "all") {
          nextPos = (nextPos + order.length) % order.length;
        } else {
          return idx; // stop at boundary
        }
      }
      return order[nextPos] ?? idx;
    });
  }, []);

  // Wire audio element lifecycle events. The element is stable across the
  // provider's lifetime so we only attach listeners once.
  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = (): void => {
      setCurrentTime(audio.currentTime);
      // Persist resume position (throttled). Keyed by track id so it survives
      // reloads and is restored on next load of the same track.
      const now = Date.now();
      if (now - lastSaveRef.current > 5000 && audio.currentTime > 0) {
        lastSaveRef.current = now;
        const track = queueRef.current[currentIndexRef.current];
        // Live streams have no meaningful resume position — never persist one.
        if (track && !track.isLive) savePosition(track.id, audio.currentTime);
      }
      // Feed the OS media UI a scrubbable position (Media Session). Reads live
      // off the element so there's no stale-closure risk in this once-attached
      // listener. Some browsers throw on invalid/incomplete state — swallow.
      if (
        typeof navigator !== "undefined" &&
        "mediaSession" in navigator &&
        typeof navigator.mediaSession.setPositionState === "function" &&
        Number.isFinite(audio.duration) &&
        audio.duration > 0
      ) {
        try {
          navigator.mediaSession.setPositionState({
            duration: audio.duration,
            position: Math.min(audio.currentTime, audio.duration),
            playbackRate: audio.playbackRate || 1,
          });
        } catch {
          /* ignore invalid position state */
        }
      }
    };
    const onDurationChange = (): void => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      // Apply a pending resume offset once we know the duration — only restore
      // a position that's past the intro and not within the trailing tail.
      if (pendingSeekRef.current != null) {
        const target = pendingSeekRef.current;
        pendingSeekRef.current = null;
        const dur = audio.duration;
        if (
          target >= RESUME_MIN_SECONDS &&
          (!Number.isFinite(dur) || target < dur - RESUME_TAIL_SECONDS)
        ) {
          audio.currentTime = target;
          setCurrentTime(target);
        }
      }
    };
    const onPlay = (): void => setIsPlaying(true);
    const onPause = (): void => setIsPlaying(false);
    // Buffering: `waiting` fires when playback stalls for data; `playing` and
    // `canplay` mean we have enough to proceed. `error` surfaces a load/decode
    // failure (DESIGN.md §17.1 error state).
    const onWaiting = (): void => setIsBuffering(true);
    const onPlaying = (): void => {
      setIsBuffering(false);
      setErrorMessage(null);
      // Successful playback — reset the live-stream retry budget.
      liveRetryCountRef.current = 0;
    };
    const onCanPlay = (): void => setIsBuffering(false);
    const onError = (): void => {
      setIsBuffering(false);
      const track = queueRef.current[currentIndexRef.current];
      // Live radio mounts intermittently 5xx on a cold connect; a fresh attempt
      // almost always succeeds. Silently retry a few times (with backoff) before
      // showing the error so live playback self-heals without a user tap.
      if (track?.isLive && liveRetryCountRef.current < MAX_LIVE_RETRIES) {
        liveRetryCountRef.current += 1;
        setIsBuffering(true);
        if (liveRetryTimerRef.current) clearTimeout(liveRetryTimerRef.current);
        liveRetryTimerRef.current = setTimeout(() => {
          liveRetryTimerRef.current = null;
          const a = audioRef.current;
          if (!a) return;
          a.load();
          void a.play().catch(() => {
            /* see note in play() */
          });
        }, LIVE_RETRY_BASE_MS * liveRetryCountRef.current);
        return;
      }
      setErrorMessage("Couldn't play this track.");
    };
    const onEnded = (): void => {
      setIsPlaying(false);
      // A finished track shouldn't resume mid-way next time.
      const ended = queueRef.current[currentIndexRef.current];
      if (ended) clearStoredPosition(ended.id);
      // "Stop at end of track" sleep mode: pause here, don't advance/replay.
      if (sleepAtTrackEndRef.current) {
        sleepAtTrackEndRef.current = false;
        setSleepAtTrackEnd(false);
        return;
      }
      // Auto-advance only after a prior user gesture this session; mobile
      // Safari would otherwise block the play() call and leave us paused.
      if (!hasInteractedRef.current) return;
      // Repeat-one: replay the current track without moving the index.
      if (repeatModeRef.current === "one") {
        audio.currentTime = 0;
        void audio.play().catch(() => {
          /* see note in play() */
        });
        return;
      }
      goRelative(1);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("loadedmetadata", onDurationChange);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("loadedmetadata", onDurationChange);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("error", onError);
    };
  }, [goRelative]);

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
      setErrorMessage(null);
      // Fresh source → fresh live-retry budget; drop any pending retry timer.
      liveRetryCountRef.current = 0;
      if (liveRetryTimerRef.current) {
        clearTimeout(liveRetryTimerRef.current);
        liveRetryTimerRef.current = null;
      }
      // Queue the saved resume offset; applied once metadata loads. Live streams
      // never resume — they play from the live edge.
      const saved = track.isLive ? 0 : getStoredPosition(track.id);
      pendingSeekRef.current = saved > 0 ? saved : null;
    }
    // Re-apply the chosen speed: a fresh src resets playbackRate to 1.
    audio.playbackRate = playbackRateRef.current;
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
      playOrderRef.current = buildPlayOrder(
        tracks.length,
        isShuffledRef.current,
        safeIndex,
      );
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
    // Cancel any in-flight live-stream auto-retry so it can't resume playback
    // after the user has deliberately paused.
    if (liveRetryTimerRef.current) {
      clearTimeout(liveRetryTimerRef.current);
      liveRetryTimerRef.current = null;
    }
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
    goRelative(1);
  }, [goRelative]);

  const prev = React.useCallback((): void => {
    goRelative(-1);
  }, [goRelative]);

  const goTo = React.useCallback(
    (index: number): void => {
      setCurrentIndex((idx) =>
        index >= 0 && index < queueRef.current.length ? index : idx,
      );
    },
    [],
  );

  // Re-attempt the current track after an error (DESIGN.md §17.1 retry).
  const retry = React.useCallback((): void => {
    const audio = audioRef.current;
    if (!audio) return;
    setErrorMessage(null);
    hasInteractedRef.current = true;
    // A manual retry gets a fresh auto-retry budget for live streams.
    liveRetryCountRef.current = 0;
    if (liveRetryTimerRef.current) {
      clearTimeout(liveRetryTimerRef.current);
      liveRetryTimerRef.current = null;
    }
    audio.load();
    void audio.play().catch(() => {
      /* see note above */
    });
  }, []);

  // Stop playback and drop the queue → currentIndex -1 makes the bar slide out
  // (hasQueue false). The currentIndex effect clears the audio src; here we also
  // cancel any pending live-retry timer so it can't resume after a close.
  const stop = React.useCallback((): void => {
    if (liveRetryTimerRef.current) {
      clearTimeout(liveRetryTimerRef.current);
      liveRetryTimerRef.current = null;
    }
    const audio = audioRef.current;
    if (audio) audio.pause();
    setErrorMessage(null);
    setQueue([]);
    setCurrentIndex(-1);
    playOrderRef.current = [];
  }, []);

  const cycleRepeat = React.useCallback((): void => {
    setRepeatMode((prev) => {
      const seq: RepeatMode[] = ["off", "all", "one"];
      const nextVal = seq[(seq.indexOf(prev) + 1) % seq.length] as RepeatMode;
      repeatModeRef.current = nextVal;
      return nextVal;
    });
  }, []);

  const toggleShuffle = React.useCallback((): void => {
    setIsShuffled((prev) => {
      const nextVal = !prev;
      isShuffledRef.current = nextVal;
      playOrderRef.current = buildPlayOrder(
        queueRef.current.length,
        nextVal,
        currentIndexRef.current,
      );
      return nextVal;
    });
  }, []);

  const setPlaybackRate = React.useCallback((rate: number): void => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = rate;
    playbackRateRef.current = rate;
    setPlaybackRateState(rate);
  }, []);

  const setVolume = React.useCallback((vol: number): void => {
    const clamped = Math.max(0, Math.min(1, vol));
    const audio = audioRef.current;
    if (audio) audio.volume = clamped;
    setVolumeState(clamped);
  }, []);

  const setSleepTimer = React.useCallback((option: SleepTimerOption): void => {
    if (sleepTimeoutRef.current) {
      clearTimeout(sleepTimeoutRef.current);
      sleepTimeoutRef.current = null;
    }
    if (option === null) {
      sleepAtTrackEndRef.current = false;
      setSleepAtTrackEnd(false);
      setSleepTimerEndsAt(null);
      return;
    }
    if (option === "end-of-track") {
      sleepAtTrackEndRef.current = true;
      setSleepAtTrackEnd(true);
      setSleepTimerEndsAt(null);
      return;
    }
    sleepAtTrackEndRef.current = false;
    setSleepAtTrackEnd(false);
    const ms = option * 60_000;
    setSleepTimerEndsAt(Date.now() + ms);
    sleepTimeoutRef.current = setTimeout(() => {
      sleepTimeoutRef.current = null;
      setSleepTimerEndsAt(null);
      // Gentle ~3s fade-out, then pause and restore the volume for next time.
      const audio = audioRef.current;
      if (!audio) return;
      const startVolume = audio.volume;
      let step = 0;
      const steps = 15;
      const fade = setInterval(() => {
        step += 1;
        audio.volume = Math.max(0, startVolume * (1 - step / steps));
        if (step >= steps) {
          clearInterval(fade);
          audio.pause();
          audio.volume = startVolume;
        }
      }, 200);
    }, ms);
  }, []);

  // Clear any pending sleep timeout when the provider unmounts.
  React.useEffect(() => {
    return () => {
      if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
    };
  }, []);

  // Media Session: keep the OS/lock-screen now-playing metadata in sync.
  React.useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !("mediaSession" in navigator) ||
      typeof MediaMetadata === "undefined"
    ) {
      return;
    }
    const currentTrack =
      currentIndex >= 0 && currentIndex < queue.length
        ? queue[currentIndex]
        : null;
    if (!currentTrack) {
      navigator.mediaSession.metadata = null;
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.playlistTitle ?? "",
      artwork: currentTrack.coverUrl
        ? [{ src: currentTrack.coverUrl, sizes: "512x512" }]
        : [],
    });
  }, [currentIndex, queue]);

  // Media Session: register transport action handlers once. Handlers are stable
  // callbacks, so this re-runs only if their identity changes (it won't).
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }
    const ms = navigator.mediaSession;
    const setHandler = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler | null,
    ): void => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        /* unsupported action on this browser — ignore */
      }
    };
    setHandler("play", () => play());
    setHandler("pause", () => pause());
    setHandler("previoustrack", () => prev());
    setHandler("nexttrack", () => next());
    setHandler("seekbackward", (details) => {
      const audio = audioRef.current;
      if (audio) seek(audio.currentTime - (details.seekOffset ?? 10));
    });
    setHandler("seekforward", (details) => {
      const audio = audioRef.current;
      if (audio) seek(audio.currentTime + (details.seekOffset ?? 10));
    });
    setHandler("seekto", (details) => {
      if (typeof details.seekTime === "number") seek(details.seekTime);
    });
    return () => {
      (
        [
          "play",
          "pause",
          "previoustrack",
          "nexttrack",
          "seekbackward",
          "seekforward",
          "seekto",
        ] as MediaSessionAction[]
      ).forEach((action) => setHandler(action, null));
    };
  }, [play, pause, prev, next, seek]);

  // Media Session: mirror the playing/paused state to the OS UI.
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

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
      isBuffering,
      errorMessage,
      currentTime,
      duration,
      hasQueue,
      currentTrack,
      repeatMode,
      isShuffled,
      playbackRate,
      volume,
      loadQueue,
      play,
      pause,
      toggle,
      seek,
      next,
      prev,
      goTo,
      retry,
      stop,
      cycleRepeat,
      toggleShuffle,
      setPlaybackRate,
      setVolume,
      sleepTimerEndsAt,
      sleepAtTrackEnd,
      setSleepTimer,
    }),
    [
      queue,
      currentIndex,
      isPlaying,
      isBuffering,
      errorMessage,
      currentTime,
      duration,
      hasQueue,
      currentTrack,
      repeatMode,
      isShuffled,
      playbackRate,
      volume,
      loadQueue,
      play,
      pause,
      toggle,
      seek,
      next,
      prev,
      goTo,
      retry,
      stop,
      cycleRepeat,
      toggleShuffle,
      setPlaybackRate,
      setVolume,
      sleepTimerEndsAt,
      sleepAtTrackEnd,
      setSleepTimer,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}
