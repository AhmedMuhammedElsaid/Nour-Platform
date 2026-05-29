import { afterEach, describe, expect, it } from "vitest";

import {
  clearRecentlyPlayed,
  readRecentlyPlayed,
  recordRecentlyPlayed,
} from "./recently-played";

describe("recently-played store", () => {
  afterEach(() => window.localStorage.clear());

  it("records a play and reads it back", () => {
    recordRecentlyPlayed({ trackId: "t1", title: "A" });
    expect(readRecentlyPlayed().map((t) => t.trackId)).toEqual(["t1"]);
  });

  it("dedupes by trackId and moves the entry to the front (MRU)", () => {
    recordRecentlyPlayed({ trackId: "t1", title: "A" });
    recordRecentlyPlayed({ trackId: "t2", title: "B" });
    recordRecentlyPlayed({ trackId: "t1", title: "A" });
    expect(readRecentlyPlayed().map((t) => t.trackId)).toEqual(["t1", "t2"]);
  });

  it("caps the history at 20 entries, newest first", () => {
    for (let i = 0; i < 25; i++) {
      recordRecentlyPlayed({ trackId: `t${i}`, title: `${i}` });
    }
    const list = readRecentlyPlayed();
    expect(list).toHaveLength(20);
    expect(list[0]?.trackId).toBe("t24");
  });

  it("clears the history", () => {
    recordRecentlyPlayed({ trackId: "t1", title: "A" });
    clearRecentlyPlayed();
    expect(readRecentlyPlayed()).toEqual([]);
  });
});
