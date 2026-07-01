// Pure player state + reducer. The offscreen document owns the live <audio>
// element and applies side effects (set src, play/pause, seek, rate, volume) by
// diffing the reducer's output; keeping the structural transitions pure makes
// them testable without a DOM or chrome mocks.

export type QueueItem = {
  id: string; // track id — keys the resume-position store (nour.player.positions)
  url: string; // absolute audio URL (carried pre-formed by /api/v1 responses)
  title: string;
  artist?: string; // playlist title / surah name
  artwork?: string; // cover image URL for Media Session
  durationSecs?: number; // shown in the queue panel + used for resume-bar math
  slug?: string; // playlist slug — lets a per-track recent deep-link back
  isLive?: boolean; // live radio stream — no seek/resume; UI shows a LIVE badge
};

export type PlayerStatus = "playing" | "paused" | "stopped";

export type RepeatMode = "off" | "all" | "one";

// minutes from now · "end-of-track" · null = off
export type SleepTimerOption = number | "end-of-track" | null;

// Canonical playback-speed presets (mirrors the web player).
export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;

// Structural state — what the reducer owns. `index` is the ACTUAL queue index of
// the current track (so `currentItem` is just `queue[index]`). `order` is the
// play sequence of queue indices: identity `[0..n-1]` when not shuffled, else a
// Fisher–Yates permutation with the current index pinned to the front. next/prev
// walk `order`. Live position/duration/rate/volume come off the audio element and
// are layered on at broadcast time (see PlayerState).
export type PlayerCore = {
  status: PlayerStatus;
  queue: QueueItem[];
  index: number; // -1 when stopped/empty
  shuffle: boolean;
  repeat: RepeatMode;
  order: number[];
};

// What the UI renders: the core plus runtime values owned by the audio engine.
export type PlayerState = PlayerCore & {
  positionSec: number;
  durationSec: number;
  playbackRate: number;
  volume: number;
  sleepTimerEndsAt: number | null;
  sleepAtTrackEnd: boolean;
  isBuffering: boolean;
  errorMessage: string | null;
};

export const EMPTY_CORE: PlayerCore = {
  status: "stopped",
  queue: [],
  index: -1,
  shuffle: false,
  repeat: "off",
  order: [],
};

export type PlayerCommand =
  | { type: "load"; queue: QueueItem[]; index: number }
  | { type: "toggle" }
  | { type: "next" }
  | { type: "prev" }
  | { type: "goTo"; index: number }
  | { type: "seek"; positionSec: number }
  | { type: "toggleShuffle" }
  | { type: "cycleRepeat" }
  | { type: "setRate"; rate: number }
  | { type: "setVolume"; volume: number }
  | { type: "setSleepTimer"; option: SleepTimerOption }
  | { type: "retry" }
  | { type: "stop" };

// Resolves the currently-selected item, or null when stopped / out of range.
export function currentItem(core: PlayerCore): QueueItem | null {
  if (core.index < 0) return null;
  return core.queue[core.index] ?? null;
}

const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(Math.max(lo, n), hi);

// Builds the play order. Not shuffled → identity. Shuffled → Fisher–Yates with
// `pinned` (the current queue index) moved to the front, so toggling shuffle
// mid-playback never restarts the current track. Impure (Math.random); callers
// that need determinism should test invariants, not exact order.
export function buildOrder(length: number, shuffle: boolean, pinned: number): number[] {
  const order = Array.from({ length }, (_, i) => i);
  if (!shuffle || length < 2) return order;
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  if (pinned >= 0) {
    const pos = order.indexOf(pinned);
    if (pos > 0) {
      order.splice(pos, 1);
      order.unshift(pinned);
    }
  }
  return order;
}

// Pure structural transition. `seek`, `setRate`, `setVolume`, `setSleepTimer`,
// and `retry` are engine-only side effects — they leave the structural core
// untouched (the offscreen applies them directly to the audio element).
export function reducePlayer(core: PlayerCore, command: PlayerCommand): PlayerCore {
  switch (command.type) {
    case "load": {
      if (command.queue.length === 0) {
        return { ...EMPTY_CORE, shuffle: core.shuffle, repeat: core.repeat };
      }
      const index = clamp(command.index, 0, command.queue.length - 1);
      return {
        status: "playing",
        queue: command.queue,
        index,
        shuffle: core.shuffle,
        repeat: core.repeat,
        order: buildOrder(command.queue.length, core.shuffle, index),
      };
    }
    case "toggle": {
      // Allows resuming from "stopped" (end-of-queue, queue still loaded).
      if (core.index < 0 || core.queue.length === 0) return core;
      return { ...core, status: core.status === "playing" ? "paused" : "playing" };
    }
    case "next": {
      if (core.queue.length === 0) return core;
      const pos = core.order.indexOf(core.index);
      const nextPos = pos + 1;
      if (nextPos >= core.order.length) {
        // Repeat-one is handled in the engine's `ended` handler (manual next
        // still advances), so here it falls through like repeat-off.
        if (core.repeat === "all") {
          return { ...core, index: core.order[0] ?? core.index, status: "playing" };
        }
        return { ...core, status: "stopped" }; // end of queue — keep it loaded
      }
      return { ...core, index: core.order[nextPos] ?? core.index, status: "playing" };
    }
    case "prev": {
      if (core.queue.length === 0) return core;
      const pos = core.order.indexOf(core.index);
      const prevPos = pos - 1;
      if (prevPos < 0) {
        if (core.repeat === "all") {
          const last = core.order[core.order.length - 1] ?? core.index;
          return { ...core, index: last, status: "playing" };
        }
        // At the first track, prev restarts it (engine seeks to 0).
        return { ...core, status: "playing" };
      }
      return { ...core, index: core.order[prevPos] ?? core.index, status: "playing" };
    }
    case "goTo": {
      if (core.queue.length === 0) return core;
      return { ...core, index: clamp(command.index, 0, core.queue.length - 1), status: "playing" };
    }
    case "toggleShuffle": {
      const shuffle = !core.shuffle;
      return { ...core, shuffle, order: buildOrder(core.queue.length, shuffle, core.index) };
    }
    case "cycleRepeat": {
      const repeat: RepeatMode =
        core.repeat === "off" ? "all" : core.repeat === "all" ? "one" : "off";
      return { ...core, repeat };
    }
    case "seek":
    case "setRate":
    case "setVolume":
    case "setSleepTimer":
    case "retry":
      return core;
    case "stop":
      return { ...EMPTY_CORE, shuffle: core.shuffle, repeat: core.repeat };
    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
}
