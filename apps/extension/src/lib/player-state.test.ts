import { describe, expect, it } from "vitest";

import {
  EMPTY_CORE,
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

const playingAt = (index: number): PlayerCore => ({
  status: "playing",
  queue: Q,
  index,
});

describe("reducePlayer", () => {
  it("load starts playing at the clamped index", () => {
    expect(reducePlayer(EMPTY_CORE, { type: "load", queue: Q, index: 1 })).toEqual({
      status: "playing",
      queue: Q,
      index: 1,
    });
    // Out-of-range index clamps into the queue.
    expect(
      reducePlayer(EMPTY_CORE, { type: "load", queue: Q, index: 99 }).index,
    ).toBe(2);
    expect(
      reducePlayer(EMPTY_CORE, { type: "load", queue: Q, index: -5 }).index,
    ).toBe(0);
  });

  it("load with an empty queue stops", () => {
    expect(reducePlayer(playingAt(0), { type: "load", queue: [], index: 0 })).toEqual(
      EMPTY_CORE,
    );
  });

  it("toggle flips playing/paused but is a no-op when stopped", () => {
    expect(reducePlayer(playingAt(0), { type: "toggle" }).status).toBe("paused");
    expect(
      reducePlayer({ ...playingAt(0), status: "paused" }, { type: "toggle" }).status,
    ).toBe("playing");
    expect(reducePlayer(EMPTY_CORE, { type: "toggle" })).toEqual(EMPTY_CORE);
  });

  it("next advances and stops past the end", () => {
    expect(reducePlayer(playingAt(0), { type: "next" }).index).toBe(1);
    expect(reducePlayer(playingAt(2), { type: "next" })).toEqual(EMPTY_CORE);
  });

  it("prev steps back and clamps at the first track", () => {
    expect(reducePlayer(playingAt(2), { type: "prev" }).index).toBe(1);
    expect(reducePlayer(playingAt(0), { type: "prev" }).index).toBe(0);
  });

  it("next/prev resume playing when paused", () => {
    const paused: PlayerCore = { ...playingAt(0), status: "paused" };
    expect(reducePlayer(paused, { type: "next" }).status).toBe("playing");
  });

  it("seek does not change structural state", () => {
    const core = playingAt(1);
    expect(reducePlayer(core, { type: "seek", positionSec: 42 })).toBe(core);
  });

  it("stop clears to empty", () => {
    expect(reducePlayer(playingAt(1), { type: "stop" })).toEqual(EMPTY_CORE);
  });
});

describe("currentItem", () => {
  it("returns the indexed item, or null when stopped/out of range", () => {
    expect(currentItem(playingAt(1))).toEqual(Q[1]);
    expect(currentItem(EMPTY_CORE)).toBeNull();
    expect(currentItem({ status: "playing", queue: Q, index: 9 })).toBeNull();
  });
});
