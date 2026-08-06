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

describe("useAyahAudio prefetch pool (widened lookahead + element handoff)", () => {
  const fourAyahs = [
    { numberGlobal: 1, audioUrl: "https://x/1.mp3" },
    { numberGlobal: 2, audioUrl: "https://x/2.mp3" },
    { numberGlobal: 3, audioUrl: "https://x/3.mp3" },
    { numberGlobal: 4, audioUrl: "https://x/4.mp3" },
  ];

  afterEach(() => {
    (window as unknown as { Audio: typeof OriginalAudio }).Audio = OriginalAudio;
  });

  // Which pool element is "active" (== audioRef.current) can change identity
  // across plays (that's the whole point of the handoff), so tests derive the
  // prefetch set as "every captured instance minus whichever one is active
  // right now" rather than assuming a fixed index.
  function prefetchSrcs(
    instances: InstanceType<typeof OriginalAudio>[],
    active: HTMLAudioElement | null,
  ): string[] {
    return instances.filter((el) => el !== active).map((el) => el.src);
  }

  it("warms the next two ayahs' URLs when an ayah starts playing", async () => {
    const instances = captureAudioInstances();
    const { result } = renderHook(() => useAyahAudio(fourAyahs));
    await act(async () => result.current.playAyah(1));

    const srcs = prefetchSrcs(instances, result.current.audioRef.current);
    expect(srcs).toContain(fourAyahs[1]!.audioUrl);
    expect(srcs).toContain(fourAyahs[2]!.audioUrl);
  });

  it("slides the prefetch window forward on auto-advance, never warming the now-active ayah", async () => {
    const instances = captureAudioInstances();
    const { result } = renderHook(() => useAyahAudio(fourAyahs));
    await act(async () => result.current.playAyah(1));
    await act(async () => {
      result.current.audioRef.current?.dispatchEvent(new Event("ended"));
    });

    // Now on ayah 2 — the window should have slid to warm ayahs 3 and 4.
    const srcs = prefetchSrcs(instances, result.current.audioRef.current);
    expect(srcs).toContain(fourAyahs[2]!.audioUrl);
    expect(srcs).toContain(fourAyahs[3]!.audioUrl);
    // Ayah 2 is the ACTIVE track now — it must never also be sitting in the
    // (non-active) prefetch set.
    expect(srcs).not.toContain(fourAyahs[1]!.audioUrl);
  });

  it("hands off to the already-warmed element on auto-advance instead of re-assigning the active one's src", async () => {
    const instances = captureAudioInstances();
    const { result } = renderHook(() => useAyahAudio(fourAyahs));
    await act(async () => result.current.playAyah(1));
    const firstActive = result.current.audioRef.current;
    const preWarmedForAyah2 = instances.find((el) => el.src === fourAyahs[1]!.audioUrl) as
      | (HTMLAudioElement & { load: ReturnType<typeof vi.fn> })
      | undefined;
    expect(preWarmedForAyah2).toBeDefined();
    const loadCallsBeforeAdvance = preWarmedForAyah2!.load.mock.calls.length;

    await act(async () => {
      result.current.audioRef.current?.dispatchEvent(new Event("ended"));
    });

    // The element that was already warmed for ayah 2 IS the new active
    // element — playAt handed off to it rather than re-assigning ayah 2's
    // URL onto the element that was just playing ayah 1.
    expect(result.current.audioRef.current).toBe(preWarmedForAyah2);
    expect(result.current.audioRef.current).not.toBe(firstActive);
    // And it was NOT reloaded — prefetchUrl's `el.src === url` guard no-ops
    // since this element already held the target URL from the warm-ahead.
    expect(preWarmedForAyah2!.load.mock.calls.length).toBe(loadCallsBeforeAdvance);
  });

  it("pauses the previously-active element on handoff", async () => {
    captureAudioInstances();
    const { result } = renderHook(() => useAyahAudio(fourAyahs));
    await act(async () => result.current.playAyah(1));
    const firstActive = result.current.audioRef.current as unknown as {
      pause: ReturnType<typeof vi.fn>;
    };

    await act(async () => {
      result.current.audioRef.current?.dispatchEvent(new Event("ended"));
    });

    expect(firstActive.pause).toHaveBeenCalled();
  });
});
