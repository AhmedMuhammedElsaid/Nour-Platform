// Pure player state + reducer. The offscreen document owns the live <audio>
// element and applies side effects (set src, play/pause, seek) by diffing the
// reducer's output; keeping the structural transitions pure makes them testable
// without a DOM or chrome mocks.

export type QueueItem = {
  id: string; // track id — keys the resume-position store (nour.player.positions)
  url: string; // absolute audio URL (carried pre-formed by /api/v1 responses)
  title: string;
  artist?: string; // playlist title / surah name
  artwork?: string; // cover image URL for Media Session
};

export type PlayerStatus = "playing" | "paused" | "stopped";

// Structural state — what the reducer owns. Live position/duration come off the
// audio element and are layered on at broadcast time (see PlayerState).
export type PlayerCore = {
  status: PlayerStatus;
  queue: QueueItem[];
  index: number; // -1 when stopped/empty
};

// What the UI renders: the core plus runtime values from the audio element.
export type PlayerState = PlayerCore & {
  positionSec: number;
  durationSec: number;
};

export const EMPTY_CORE: PlayerCore = { status: "stopped", queue: [], index: -1 };

export type PlayerCommand =
  | { type: "load"; queue: QueueItem[]; index: number }
  | { type: "toggle" }
  | { type: "next" }
  | { type: "prev" }
  | { type: "seek"; positionSec: number }
  | { type: "stop" };

// Resolves the currently-selected item, or null when stopped / out of range.
export function currentItem(core: PlayerCore): QueueItem | null {
  if (core.index < 0) return null;
  return core.queue[core.index] ?? null;
}

// Pure structural transition. `seek` is a no-op here — it only moves the audio
// element's playhead, which the offscreen handles directly.
export function reducePlayer(core: PlayerCore, command: PlayerCommand): PlayerCore {
  switch (command.type) {
    case "load": {
      if (command.queue.length === 0) return EMPTY_CORE;
      const index = Math.min(Math.max(0, command.index), command.queue.length - 1);
      return { status: "playing", queue: command.queue, index };
    }
    case "toggle": {
      if (core.status === "stopped") return core;
      return { ...core, status: core.status === "playing" ? "paused" : "playing" };
    }
    case "next": {
      if (core.status === "stopped") return core;
      const next = core.index + 1;
      if (next >= core.queue.length) return EMPTY_CORE; // past the end → stop
      return { ...core, index: next, status: "playing" };
    }
    case "prev": {
      if (core.status === "stopped") return core;
      // Clamp at 0 — at the first track, prev restarts it (offscreen seeks to 0).
      return { ...core, index: Math.max(0, core.index - 1), status: "playing" };
    }
    case "seek":
      return core;
    case "stop":
      return EMPTY_CORE;
    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
}
