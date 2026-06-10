import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAyahAudio } from "./use-ayah-audio";

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
