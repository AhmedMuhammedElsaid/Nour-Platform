// Mobile player context — parity with packages/ui/src/blocks/audio-player/player-context.tsx.
// Uses react-native-track-player (RNTP) instead of HTMLAudioElement. Queue
// ordering (shuffle), repeat modes, sleep timer, resume positions, and prefs
// persistence are managed in JS (same algorithms as web). RNTP handles native
// background playback, lock-screen controls, and the OS Now-Playing card.

import * as React from "react";
import TrackPlayer, {
  Capability,
  Event,
  RepeatMode as RNTPRepeatMode,
  State as RNTPState,
  usePlaybackState,
  useProgress,
  useTrackPlayerEvents,
} from "react-native-track-player";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ---------------------------------------------------------------------------
// Public types — same as web
// ---------------------------------------------------------------------------

export type QueueTrack = {
  id: string;
  title: string;
  mediaUrl: string;
  durationSecs?: number;
  coverUrl?: string;
  playlistTitle?: string;
  playlistSlug?: string;
  locale?: string;
};

export type RepeatMode = "off" | "all" | "one";
export type SleepTimerOption = number | "end-of-track" | null;
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
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (vol: number) => void;
  sleepTimerEndsAt: number | null;
  sleepAtTrackEnd: boolean;
  setSleepTimer: (option: SleepTimerOption) => void;
};

const PlayerContext = React.createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const ctx = React.useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within a PlayerProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// Device-local prefs + positions (mirrors web's localStorage keys)
// ---------------------------------------------------------------------------

const PREFS_KEY = "nour.player.prefs";
const POSITIONS_KEY = "nour.player.positions";
const RECENT_KEY = "nour.player.recent";
const MAX_POSITIONS = 100;
const MAX_RECENT = 20;
const RESUME_MIN_SECONDS = 5;
const RESUME_TAIL_SECONDS = 10;

type PlayerPrefs = {
  playbackRate: number;
  repeatMode: RepeatMode;
  isShuffled: boolean;
  volume: number;
};

type StoredPositions = Record<string, { t: number; at: number }>;

async function readPrefs(): Promise<PlayerPrefs | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PlayerPrefs>;
    return {
      playbackRate: typeof p.playbackRate === "number" ? p.playbackRate : 1,
      repeatMode:
        p.repeatMode === "all" || p.repeatMode === "one" ? p.repeatMode : "off",
      isShuffled: Boolean(p.isShuffled),
      volume:
        typeof p.volume === "number" && p.volume >= 0 && p.volume <= 1
          ? p.volume
          : 1,
    };
  } catch {
    return null;
  }
}

async function writePrefs(prefs: PlayerPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* non-fatal */
  }
}

async function readPositions(): Promise<StoredPositions> {
  try {
    const raw = await AsyncStorage.getItem(POSITIONS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as StoredPositions)
      : {};
  } catch {
    return {};
  }
}

async function savePosition(trackId: string, seconds: number): Promise<void> {
  try {
    const positions = await readPositions();
    positions[trackId] = { t: seconds, at: Date.now() };
    const ids = Object.keys(positions);
    if (ids.length > MAX_POSITIONS) {
      ids
        .sort((a, b) => (positions[a]?.at ?? 0) - (positions[b]?.at ?? 0))
        .slice(0, ids.length - MAX_POSITIONS)
        .forEach((id) => delete positions[id]);
    }
    await AsyncStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
  } catch {
    /* non-fatal */
  }
}

async function getStoredPosition(trackId: string): Promise<number> {
  const entry = (await readPositions())[trackId];
  return entry && typeof entry.t === "number" ? entry.t : 0;
}

async function clearStoredPosition(trackId: string): Promise<void> {
  try {
    const positions = await readPositions();
    if (positions[trackId]) {
      delete positions[trackId];
      await AsyncStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
    }
  } catch {
    /* non-fatal */
  }
}

// Recently-played writer — Phase 4 had the reader stub; this completes it.
type RecentEntry = {
  trackId: string;
  title: string;
  playlistTitle?: string;
  playlistSlug?: string;
  duration?: number;
  updatedAt: number;
};

async function recordRecentlyPlayed(entry: Omit<RecentEntry, "updatedAt">): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    const list: RecentEntry[] = raw ? (JSON.parse(raw) as RecentEntry[]) : [];
    const idx = list.findIndex((e) => e.trackId === entry.trackId);
    if (idx !== -1) list.splice(idx, 1);
    list.unshift({ ...entry, updatedAt: Date.now() });
    if (list.length > MAX_RECENT) list.length = MAX_RECENT;
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* non-fatal */
  }
}

// ---------------------------------------------------------------------------
// Shuffle (Fisher–Yates) — same as web
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// RNTP setup (idempotent)
// ---------------------------------------------------------------------------

let isSetup = false;

async function setupPlayer(): Promise<void> {
  if (isSetup) return;
  try {
    await TrackPlayer.setupPlayer({
      // Keep a small forward buffer for smooth playback on mobile data.
      minBuffer: 30,
      maxBuffer: 120,
      backBuffer: 30,
    });
    await TrackPlayer.updateOptions({
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.Stop,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
        Capability.JumpForward,
        Capability.JumpBackward,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
      ],
      forwardJumpInterval: 10,
      backwardJumpInterval: 10,
    });
    // Tell RNTP not to auto-handle track advancement — we drive it ourselves
    // (to support shuffle + repeat parity with the web).
    await TrackPlayer.setRepeatMode(RNTPRepeatMode.Off);
    isSetup = true;
  } catch {
    // setupPlayer throws if called twice; swallow — we're idempotent.
    isSetup = true;
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = React.useState<QueueTrack[]>([]);
  const [currentIndex, setCurrentIndex] = React.useState(-1);
  const [repeatModeState, setRepeatModeState] =
    React.useState<RepeatMode>("off");
  const [isShuffled, setIsShuffled] = React.useState(false);
  const [playbackRate, setPlaybackRateState] = React.useState(1);
  const [volumeState, setVolumeState] = React.useState(1);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [sleepTimerEndsAt, setSleepTimerEndsAt] = React.useState<number | null>(
    null,
  );
  const [sleepAtTrackEnd, setSleepAtTrackEnd] = React.useState(false);

  // Refs for stable callbacks.
  const queueRef = React.useRef(queue);
  const currentIndexRef = React.useRef(currentIndex);
  const repeatModeRef = React.useRef(repeatModeState);
  const isShuffledRef = React.useRef(isShuffled);
  const playbackRateRef = React.useRef(playbackRate);
  const playOrderRef = React.useRef<number[]>([]);
  const prefsHydratedRef = React.useRef(false);
  const sleepTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const sleepAtTrackEndRef = React.useRef(false);
  const lastSaveRef = React.useRef(0);

  queueRef.current = queue;
  currentIndexRef.current = currentIndex;

  // RNTP hooks.
  const playbackState = usePlaybackState();
  const progress = useProgress(250);

  const isPlaying = playbackState.state === RNTPState.Playing;
  const isBuffering =
    playbackState.state === RNTPState.Buffering ||
    playbackState.state === RNTPState.Loading;

  // Setup RNTP on mount.
  React.useEffect(() => {
    void setupPlayer();
  }, []);

  // Hydrate prefs.
  React.useEffect(() => {
    void readPrefs().then((prefs) => {
      if (!prefs) {
        prefsHydratedRef.current = true;
        return;
      }
      setPlaybackRateState(prefs.playbackRate);
      playbackRateRef.current = prefs.playbackRate;
      setRepeatModeState(prefs.repeatMode);
      repeatModeRef.current = prefs.repeatMode;
      setIsShuffled(prefs.isShuffled);
      isShuffledRef.current = prefs.isShuffled;
      setVolumeState(prefs.volume);
      void TrackPlayer.setVolume(prefs.volume).catch(() => {});
      prefsHydratedRef.current = true;
    });
  }, []);

  // Persist prefs on change.
  React.useEffect(() => {
    if (!prefsHydratedRef.current) return;
    void writePrefs({
      playbackRate,
      repeatMode: repeatModeState,
      isShuffled,
      volume: volumeState,
    });
  }, [playbackRate, repeatModeState, isShuffled, volumeState]);

  // Persist resume position periodically.
  React.useEffect(() => {
    const now = Date.now();
    if (
      now - lastSaveRef.current > 5000 &&
      progress.position > 0 &&
      currentIndex >= 0
    ) {
      lastSaveRef.current = now;
      const track = queueRef.current[currentIndex];
      if (track) void savePosition(track.id, progress.position);
    }
  }, [progress.position, currentIndex]);

  // Handle RNTP track ending — drive our own repeat/shuffle advancement.
  useTrackPlayerEvents([Event.PlaybackQueueEnded], () => {
    const idx = currentIndexRef.current;
    const q = queueRef.current;
    if (idx < 0 || q.length === 0) return;

    // Clear the finished track's resume position.
    const ended = q[idx];
    if (ended) void clearStoredPosition(ended.id);

    // "Stop at end of track" sleep mode.
    if (sleepAtTrackEndRef.current) {
      sleepAtTrackEndRef.current = false;
      setSleepAtTrackEnd(false);
      return;
    }

    // Repeat-one: replay.
    if (repeatModeRef.current === "one") {
      void TrackPlayer.seekTo(0).then(() => TrackPlayer.play());
      return;
    }

    // Advance through our play order.
    const order = playOrderRef.current;
    const pos = order.indexOf(idx);
    if (pos === -1) return;
    let nextPos = pos + 1;
    if (nextPos >= order.length) {
      if (repeatModeRef.current === "all") {
        nextPos = 0;
      } else {
        return; // stop at boundary
      }
    }
    const nextIndex = order[nextPos];
    if (nextIndex != null) {
      setCurrentIndex(nextIndex);
    }
  });

  // Handle playback errors.
  useTrackPlayerEvents([Event.PlaybackError], (event) => {
    setErrorMessage(
      (event as unknown as { message?: string }).message ??
        "Couldn't play this track.",
    );
  });

  // When currentIndex changes, load the track into RNTP and play.
  React.useEffect(() => {
    if (currentIndex < 0 || currentIndex >= queue.length) return;
    const track = queue[currentIndex];
    if (!track) return;

    const load = async (): Promise<void> => {
      await setupPlayer();
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: track.id,
        url: track.mediaUrl,
        title: track.title,
        artist: track.playlistTitle ?? "",
        artwork: track.coverUrl,
        duration: track.durationSecs,
      });

      // Apply stored rate.
      await TrackPlayer.setRate(playbackRateRef.current);

      // Resume position.
      const saved = await getStoredPosition(track.id);
      if (saved >= RESUME_MIN_SECONDS) {
        const dur = track.durationSecs ?? 0;
        if (!dur || saved < dur - RESUME_TAIL_SECONDS) {
          await TrackPlayer.seekTo(saved);
        }
      }

      await TrackPlayer.play();
      setErrorMessage(null);

      // Record in recently-played.
      void recordRecentlyPlayed({
        trackId: track.id,
        title: track.title,
        playlistTitle: track.playlistTitle,
        playlistSlug: track.playlistSlug,
        duration: track.durationSecs,
      });
    };

    void load().catch(() => {
      setErrorMessage("Couldn't play this track.");
    });
  }, [currentIndex, queue]);

  // -----------------------------------------------------------------------
  // Imperative API (same contract as web)
  // -----------------------------------------------------------------------

  const loadQueue = React.useCallback(
    (tracks: QueueTrack[], startIndex = 0): void => {
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
    void TrackPlayer.play();
  }, []);

  const pause = React.useCallback((): void => {
    void TrackPlayer.pause();
  }, []);

  const toggle = React.useCallback((): void => {
    if (isPlaying) {
      void TrackPlayer.pause();
    } else {
      void TrackPlayer.play();
    }
  }, [isPlaying]);

  const seek = React.useCallback((seconds: number): void => {
    void TrackPlayer.seekTo(Math.max(0, seconds));
  }, []);

  const goRelative = React.useCallback((direction: 1 | -1): void => {
    const order = playOrderRef.current;
    const idx = currentIndexRef.current;
    if (idx < 0 || order.length === 0) return;
    const pos = order.indexOf(idx);
    if (pos === -1) return;
    let nextPos = pos + direction;
    if (nextPos < 0 || nextPos >= order.length) {
      if (repeatModeRef.current === "all") {
        nextPos = (nextPos + order.length) % order.length;
      } else {
        return;
      }
    }
    const nextIndex = order[nextPos];
    if (nextIndex != null) setCurrentIndex(nextIndex);
  }, []);

  const next = React.useCallback((): void => goRelative(1), [goRelative]);
  const prev = React.useCallback((): void => goRelative(-1), [goRelative]);

  const goTo = React.useCallback((index: number): void => {
    if (index >= 0 && index < queueRef.current.length) setCurrentIndex(index);
  }, []);

  const retry = React.useCallback((): void => {
    setErrorMessage(null);
    void TrackPlayer.seekTo(0).then(() => TrackPlayer.play());
  }, []);

  const cycleRepeat = React.useCallback((): void => {
    setRepeatModeState((prev) => {
      const seq: RepeatMode[] = ["off", "all", "one"];
      const next = seq[(seq.indexOf(prev) + 1) % seq.length] as RepeatMode;
      repeatModeRef.current = next;
      return next;
    });
  }, []);

  const toggleShuffle = React.useCallback((): void => {
    setIsShuffled((prev) => {
      const next = !prev;
      isShuffledRef.current = next;
      playOrderRef.current = buildPlayOrder(
        queueRef.current.length,
        next,
        currentIndexRef.current,
      );
      return next;
    });
  }, []);

  const setPlaybackRate = React.useCallback((rate: number): void => {
    playbackRateRef.current = rate;
    setPlaybackRateState(rate);
    void TrackPlayer.setRate(rate);
  }, []);

  const setVolume = React.useCallback((vol: number): void => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    void TrackPlayer.setVolume(clamped);
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
      // Gentle fade-out over ~3s, then pause and restore volume.
      let step = 0;
      const steps = 15;
      const startVol = volumeState;
      const fade = setInterval(() => {
        step += 1;
        const v = Math.max(0, startVol * (1 - step / steps));
        void TrackPlayer.setVolume(v);
        if (step >= steps) {
          clearInterval(fade);
          void TrackPlayer.pause();
          void TrackPlayer.setVolume(startVol);
        }
      }, 200);
    }, ms);
  }, [volumeState]);

  // Cleanup sleep timeout on unmount.
  React.useEffect(() => {
    return () => {
      if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
    };
  }, []);

  // -----------------------------------------------------------------------
  // Context value
  // -----------------------------------------------------------------------

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
      currentTime: progress.position,
      duration: progress.duration,
      hasQueue,
      currentTrack,
      repeatMode: repeatModeState,
      isShuffled,
      playbackRate,
      volume: volumeState,
      loadQueue,
      play,
      pause,
      toggle,
      seek,
      next,
      prev,
      goTo,
      retry,
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
      progress.position,
      progress.duration,
      hasQueue,
      currentTrack,
      repeatModeState,
      isShuffled,
      playbackRate,
      volumeState,
      loadQueue,
      play,
      pause,
      toggle,
      seek,
      next,
      prev,
      goTo,
      retry,
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
