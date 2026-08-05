// Pure helpers backing the RNTP native-queue lookahead (player-context.tsx).
// Kept dependency-free from react-native-track-player so the tricky ordering
// math is testable without the native mock.

import {
  NATIVE_QUEUE_LOOKAHEAD,
  indexOfTrackId,
  toNativeTrack,
  upcomingIndices,
} from "@/lib/native-queue";
import type { QueueTrack } from "@/lib/player-context";

describe("upcomingIndices", () => {
  it("walks forward through a shuffled play order", () => {
    // order[i] = queue index at play-order position i. Currently at queue
    // index 3 (play-order position 1) — the next two plays are queue indices
    // 0 and 4.
    const order = [2, 3, 0, 4, 1];
    expect(upcomingIndices(order, 3, "off", 2)).toEqual([0, 4]);
  });

  it("stops at the boundary when repeat is off", () => {
    const order = [0, 1, 2, 3];
    // Currently at the last position — nothing further to queue.
    expect(upcomingIndices(order, 3, "off", 2)).toEqual([]);
    // One before the end — only one more exists.
    expect(upcomingIndices(order, 2, "off", 2)).toEqual([3]);
  });

  it("wraps around when repeat is all", () => {
    const order = [0, 1, 2, 3];
    expect(upcomingIndices(order, 3, "all", 2)).toEqual([0, 1]);
  });

  it("never returns the current index twice when wrapping", () => {
    const order = [0, 1, 2];
    // Ask for way more than exist — must stop after visiting every other
    // position once, never looping back to re-include the current one.
    expect(upcomingIndices(order, 0, "all", 10)).toEqual([1, 2]);
  });

  it("returns nothing for repeat-one", () => {
    const order = [0, 1, 2, 3];
    expect(upcomingIndices(order, 0, "one", 2)).toEqual([]);
  });

  it("returns nothing for a single-track queue regardless of repeat mode", () => {
    expect(upcomingIndices([0], 0, "off", 2)).toEqual([]);
    expect(upcomingIndices([0], 0, "all", 2)).toEqual([]);
  });

  it("returns nothing when the current index is not present in the order", () => {
    const order = [0, 1, 2];
    expect(upcomingIndices(order, 99, "off", 2)).toEqual([]);
  });

  it("returns nothing for an empty order", () => {
    expect(upcomingIndices([], 0, "off", 2)).toEqual([]);
  });

  it("returns nothing when count is zero or negative", () => {
    const order = [0, 1, 2, 3];
    expect(upcomingIndices(order, 0, "off", 0)).toEqual([]);
    expect(upcomingIndices(order, 0, "off", -1)).toEqual([]);
  });

  it("caps at what's available when count exceeds the remaining order", () => {
    const order = [0, 1, 2, 3];
    expect(upcomingIndices(order, 0, "off", 10)).toEqual([1, 2, 3]);
  });
});

describe("toNativeTrack", () => {
  const track: QueueTrack = {
    id: "quran:2",
    title: "Al-Fatiha · 2",
    mediaUrl: "https://everyayah.com/data/Alafasy_128kbps/001002.mp3",
    coverUrl: "https://example.com/cover.png",
    playlistTitle: "Al-Afasy",
    durationSecs: 4,
  };

  it("prefers a local file over the remote URL", () => {
    const native = toNativeTrack(track, "/local/quran-2.mp3");
    expect(native.url).toBe("/local/quran-2.mp3");
    expect(native.id).toBe("quran:2");
    expect(native.title).toBe(track.title);
    expect(native.artist).toBe("Al-Afasy");
    expect(native.artwork).toBe(track.coverUrl);
    expect(native.duration).toBe(4);
  });

  it("falls back to the remote URL with no local path", () => {
    const native = toNativeTrack(track, null);
    expect(native.url).toBe(track.mediaUrl);
  });

  it("defaults artist to an empty string when the track has no playlistTitle", () => {
    const native = toNativeTrack({ ...track, playlistTitle: undefined }, null);
    expect(native.artist).toBe("");
  });
});

describe("indexOfTrackId", () => {
  const queue: QueueTrack[] = [
    { id: "quran:1", title: "1", mediaUrl: "https://x/1.mp3" },
    { id: "quran:2", title: "2", mediaUrl: "https://x/2.mp3" },
  ];

  it("finds the queue index for a matching string id", () => {
    expect(indexOfTrackId(queue, "quran:2")).toBe(1);
  });

  it("stringifies a numeric id before matching", () => {
    const numericQueue: QueueTrack[] = [{ id: "7", title: "t", mediaUrl: "https://x/7.mp3" }];
    expect(indexOfTrackId(numericQueue, 7)).toBe(0);
  });

  it("returns -1 for a missing id", () => {
    expect(indexOfTrackId(queue, "quran:99")).toBe(-1);
  });

  it("returns -1 for a null/undefined id", () => {
    expect(indexOfTrackId(queue, undefined)).toBe(-1);
    expect(indexOfTrackId(queue, null)).toBe(-1);
  });
});

it("exports a lookahead depth of 2", () => {
  expect(NATIVE_QUEUE_LOOKAHEAD).toBe(2);
});
