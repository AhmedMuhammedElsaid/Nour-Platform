import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { lookaheadUrls, useAyahAudio } from "./use-ayah-audio";

describe("lookaheadUrls", () => {
  const ayahs = [
    { numberGlobal: 1, audioUrl: "https://x/1.mp3" },
    { numberGlobal: 2, audioUrl: "https://x/2.mp3" },
    { numberGlobal: 3, audioUrl: null },
    { numberGlobal: 4, audioUrl: "https://x/4.mp3" },
    { numberGlobal: 5, audioUrl: "https://x/5.mp3" },
  ];

  it("returns the next `count` non-null URLs after index", () => {
    expect(lookaheadUrls(ayahs, 0, 2)).toEqual(["https://x/2.mp3", "https://x/4.mp3"]);
  });

  it("skips a null audioUrl without counting it toward `count`", () => {
    // index 1 -> next is index 2 (null, skipped) then index 3, 4.
    expect(lookaheadUrls(ayahs, 1, 2)).toEqual(["https://x/4.mp3", "https://x/5.mp3"]);
  });

  it("caps at what's available when count exceeds the remaining list", () => {
    expect(lookaheadUrls(ayahs, 3, 5)).toEqual(["https://x/5.mp3"]);
  });

  it("returns an empty array at the last index", () => {
    expect(lookaheadUrls(ayahs, 4, 2)).toEqual([]);
  });

  it("returns an empty array for an empty list", () => {
    expect(lookaheadUrls([], 0, 2)).toEqual([]);
  });

  it("returns an empty array when count is 0", () => {
    expect(lookaheadUrls(ayahs, 0, 0)).toEqual([]);
  });
});

const playable = [
  { numberGlobal: 1, audioUrl: "https://x/001001.mp3" },
  { numberGlobal: 2, audioUrl: "https://x/001002.mp3" },
];

beforeEach(() => {
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("useAyahAudio", () => {
  it("sets the current ayah on play", async () => {
    const { result } = renderHook(() => useAyahAudio(playable));
    await act(async () => result.current.playAyah(1));
    expect(result.current.currentGlobal).toBe(1);
    expect(result.current.isPlaying).toBe(true);
  });

  it("auto-advances to the next ayah on 'ended'", async () => {
    const { result } = renderHook(() => useAyahAudio(playable));
    await act(async () => result.current.playAyah(1));
    await act(async () => {
      result.current.audioRef.current?.dispatchEvent(new Event("ended"));
    });
    expect(result.current.currentGlobal).toBe(2);
  });

  it("stops at the end of the surah", async () => {
    const { result } = renderHook(() => useAyahAudio(playable));
    await act(async () => result.current.playAyah(2));
    await act(async () => {
      result.current.audioRef.current?.dispatchEvent(new Event("ended"));
    });
    expect(result.current.currentGlobal).toBeNull();
    expect(result.current.isPlaying).toBe(false);
  });

  it("invokes onPlaybackStart when an ayah starts", async () => {
    const onPlaybackStart = vi.fn();
    const { result } = renderHook(() => useAyahAudio(playable, { onPlaybackStart }));
    await act(async () => result.current.playAyah(1));
    expect(onPlaybackStart).toHaveBeenCalledTimes(1);
  });

  it("invokes onPlaybackStart again when toggling from paused to playing", async () => {
    const onPlaybackStart = vi.fn();
    const { result } = renderHook(() => useAyahAudio(playable, { onPlaybackStart }));
    await act(async () => result.current.playAyah(1));
    await act(async () => result.current.toggle()); // pause
    await act(async () => result.current.toggle()); // resume
    expect(onPlaybackStart).toHaveBeenCalledTimes(2);
  });

  it("repeats the same ayah when repeatAyah is on", async () => {
    const { result } = renderHook(() => useAyahAudio(playable));
    await act(async () => result.current.setRepeatAyah(true));
    await act(async () => result.current.playAyah(1));
    await act(async () => {
      result.current.audioRef.current?.dispatchEvent(new Event("ended"));
    });
    expect(result.current.currentGlobal).toBe(1);
  });
});

// vitest.setup.ts replaces window.Audio globally with a MockAudio (extends
// EventTarget) whose play/pause/load are OWN instance vi.fn()s — jsdom has no
// real HTMLMediaElement playback. That means spying on
// HTMLMediaElement.prototype (as the pre-existing beforeEach above does, and
// which has no effect on MockAudio instances) can't observe prefetch-pool
// activity. Instead, subclass the current window.Audio to capture every
// constructed instance so tests can read `.src` / `.load.mock.calls`
// directly off them.
const OriginalAudio = window.Audio;

function captureAudioInstances(): InstanceType<typeof OriginalAudio>[] {
  const instances: InstanceType<typeof OriginalAudio>[] = [];
  class TrackedAudio extends OriginalAudio {
    constructor(...args: ConstructorParameters<typeof OriginalAudio>) {
      super(...args);
      instances.push(this);
    }
  }
  (window as unknown as { Audio: typeof OriginalAudio }).Audio = TrackedAudio;
  return instances;
}

describe("useAyahAudio prefetch pool (Step A: widened lookahead)", () => {
  const fourAyahs = [
    { numberGlobal: 1, audioUrl: "https://x/1.mp3" },
    { numberGlobal: 2, audioUrl: "https://x/2.mp3" },
    { numberGlobal: 3, audioUrl: "https://x/3.mp3" },
    { numberGlobal: 4, audioUrl: "https://x/4.mp3" },
  ];

  afterEach(() => {
    (window as unknown as { Audio: typeof OriginalAudio }).Audio = OriginalAudio;
  });

  it("warms the next two ayahs' URLs when an ayah starts playing", async () => {
    const instances = captureAudioInstances();
    const { result } = renderHook(() => useAyahAudio(fourAyahs));
    await act(async () => result.current.playAyah(1));

    // instances[0] is the main (playing) element; the rest are the prefetch
    // pool, created in the same lazy-init block right after it.
    const prefetchSrcs = instances.slice(1).map((el) => el.src);
    expect(prefetchSrcs).toContain(fourAyahs[1]!.audioUrl);
    expect(prefetchSrcs).toContain(fourAyahs[2]!.audioUrl);
  });

  it("slides the prefetch window forward on auto-advance, never warming the now-consumed ayah", async () => {
    const instances = captureAudioInstances();
    const { result } = renderHook(() => useAyahAudio(fourAyahs));
    await act(async () => result.current.playAyah(1));
    await act(async () => {
      result.current.audioRef.current?.dispatchEvent(new Event("ended"));
    });

    // Now on ayah 2 — the window should have slid to warm ayahs 3 and 4.
    const prefetchSrcs = instances.slice(1).map((el) => el.src);
    expect(prefetchSrcs).toContain(fourAyahs[2]!.audioUrl);
    expect(prefetchSrcs).toContain(fourAyahs[3]!.audioUrl);
    // Ayah 2 itself is the ACTIVE track now, played via a direct src
    // assignment on the main element — it must never end up assigned to a
    // pool (prefetch) element.
    expect(prefetchSrcs).not.toContain(fourAyahs[1]!.audioUrl);
  });
});
