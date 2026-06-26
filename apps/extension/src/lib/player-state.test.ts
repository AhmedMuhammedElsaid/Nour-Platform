import { describe, expect, it } from "vitest";

import {
  EMPTY_CORE,
  buildOrder,
  currentItem,
  reducePlayer,
  type PlayerCore,
  type QueueItem,
} from "./player-state";

const Q: QueueItem[] = [
  { id: "a", url: "https://x/a.mp3", title: "A" },
  { id: "b", url: "https://x/b.mp3", title: "B" },
  { id: "c", url: "https://x/c.mp3", title: "C" },
];

// Builds a playing core with sensible defaults (identity order); override per test.
const core = (over: Partial<PlayerCore> = {}): PlayerCore => ({
  status: "playing",
  queue: Q,
  index: 0,
  shuffle: false,
  repeat: "off",
  order: [0, 1, 2],
  ...over,
});

const playingAt = (index: number): PlayerCore => core({ index });

describe("reducePlayer", () => {
  it("load starts playing at the clamped index with an identity order", () => {
    const r = reducePlayer(EMPTY_CORE, { type: "load", queue: Q, index: 1 });
    expect(r.status).toBe("playing");
    expect(r.index).toBe(1);
    expect(r.order).toEqual([0, 1, 2]);
    expect(reducePlayer(EMPTY_CORE, { type: "load", queue: Q, index: 99 }).index).toBe(2);
    expect(reducePlayer(EMPTY_CORE, { type: "load", queue: Q, index: -5 }).index).toBe(0);
  });

  it("load preserves shuffle/repeat and pins the start index when shuffled", () => {
    const from = core({ shuffle: true, repeat: "all" });
    const r = reducePlayer(from, { type: "load", queue: Q, index: 2 });
    expect(r.shuffle).toBe(true);
    expect(r.repeat).toBe("all");
    expect(r.index).toBe(2);
    expect(r.order[0]).toBe(2); // current pinned to front
    expect([...r.order].sort()).toEqual([0, 1, 2]); // still a permutation
  });

  it("load with an empty queue stops (keeping prefs)", () => {
    expect(reducePlayer(playingAt(0), { type: "load", queue: [], index: 0 })).toEqual(
      EMPTY_CORE,
    );
  });

  it("toggle flips playing/paused, resumes from stopped, no-op when empty", () => {
    expect(reducePlayer(playingAt(0), { type: "toggle" }).status).toBe("paused");
    expect(reducePlayer(core({ status: "paused" }), { type: "toggle" }).status).toBe("playing");
    // Stopped but queue still loaded (end-of-queue) → toggle resumes.
    expect(reducePlayer(core({ status: "stopped", index: 2 }), { type: "toggle" }).status).toBe(
      "playing",
    );
    expect(reducePlayer(EMPTY_CORE, { type: "toggle" })).toEqual(EMPTY_CORE);
  });

  it("next advances; at the end it stops (repeat off) or wraps (repeat all)", () => {
    expect(reducePlayer(playingAt(0), { type: "next" }).index).toBe(1);
    const end = reducePlayer(playingAt(2), { type: "next" });
    expect(end.status).toBe("stopped");
    expect(end.index).toBe(2); // queue kept, not cleared
    expect(end.queue).toHaveLength(3);
    const wrap = reducePlayer(core({ index: 2, repeat: "all" }), { type: "next" });
    expect(wrap.index).toBe(0);
    expect(wrap.status).toBe("playing");
  });

  it("prev steps back; at the first track restarts (off) or wraps (all)", () => {
    expect(reducePlayer(playingAt(2), { type: "prev" }).index).toBe(1);
    const first = reducePlayer(playingAt(0), { type: "prev" });
    expect(first.index).toBe(0);
    expect(first.status).toBe("playing");
    const wrap = reducePlayer(core({ index: 0, repeat: "all" }), { type: "prev" });
    expect(wrap.index).toBe(2);
  });

  it("next/prev follow the play order, not the queue order", () => {
    const shuffled = core({ index: 2, order: [2, 0, 1] });
    expect(reducePlayer(shuffled, { type: "next" }).index).toBe(0);
    expect(reducePlayer(core({ index: 0, order: [2, 0, 1] }), { type: "prev" }).index).toBe(2);
  });

  it("goTo jumps to a clamped queue index and plays", () => {
    expect(reducePlayer(core({ status: "paused" }), { type: "goTo", index: 2 })).toMatchObject({
      index: 2,
      status: "playing",
    });
    expect(reducePlayer(playingAt(0), { type: "goTo", index: 99 }).index).toBe(2);
  });

  it("toggleShuffle rebuilds the order, pinning the current track", () => {
    const on = reducePlayer(playingAt(1), { type: "toggleShuffle" });
    expect(on.shuffle).toBe(true);
    expect(on.order[0]).toBe(1); // current pinned
    expect([...on.order].sort()).toEqual([0, 1, 2]);
    // Toggling back restores the identity order.
    expect(reducePlayer(on, { type: "toggleShuffle" }).order).toEqual([0, 1, 2]);
  });

  it("cycleRepeat cycles off → all → one → off", () => {
    const off = playingAt(0);
    const all = reducePlayer(off, { type: "cycleRepeat" });
    expect(all.repeat).toBe("all");
    const one = reducePlayer(all, { type: "cycleRepeat" });
    expect(one.repeat).toBe("one");
    expect(reducePlayer(one, { type: "cycleRepeat" }).repeat).toBe("off");
  });

  it("engine-only commands leave the structural core untouched", () => {
    const c = playingAt(1);
    expect(reducePlayer(c, { type: "seek", positionSec: 42 })).toBe(c);
    expect(reducePlayer(c, { type: "setRate", rate: 1.5 })).toBe(c);
    expect(reducePlayer(c, { type: "setVolume", volume: 0.3 })).toBe(c);
    expect(reducePlayer(c, { type: "setSleepTimer", option: 15 })).toBe(c);
    expect(reducePlayer(c, { type: "retry" })).toBe(c);
  });

  it("stop clears the queue but keeps shuffle/repeat prefs", () => {
    const r = reducePlayer(core({ index: 1, shuffle: true, repeat: "one" }), { type: "stop" });
    expect(r.queue).toHaveLength(0);
    expect(r.index).toBe(-1);
    expect(r.shuffle).toBe(true);
    expect(r.repeat).toBe("one");
  });
});

describe("buildOrder", () => {
  it("returns identity when not shuffled", () => {
    expect(buildOrder(4, false, 0)).toEqual([0, 1, 2, 3]);
  });

  it("returns a permutation with the pinned index first when shuffled", () => {
    for (let trial = 0; trial < 20; trial++) {
      const o = buildOrder(6, true, 3);
      expect(o[0]).toBe(3);
      expect([...o].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
    }
  });
});

describe("currentItem", () => {
  it("returns the indexed item, or null when stopped/out of range", () => {
    expect(currentItem(playingAt(1))).toEqual(Q[1]);
    expect(currentItem(EMPTY_CORE)).toBeNull();
    expect(currentItem(core({ index: 9 }))).toBeNull();
  });
});
