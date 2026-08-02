// Regression tests for the 2026-07-28 performance pass. These lock in the two
// invariants that are easy to silently undo in a later refactor and that only
// show up on a device as "the app feels laggy":
//
//  1. `usePlayerActions()` is identity-stable, so an actions-only consumer
//     never re-renders because playback state changed.
//  2. `getLocalPath()` does not hit the filesystem for a track that was never
//     downloaded — it sits in the player's track-load path, and the sync
//     `File.exists` stat blocks the JS thread on every track change.

import * as React from "react";
import { act, render } from "@testing-library/react-native";
import { Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { File as FSFile } from "expo-file-system";
import { usePlaybackState, useProgress } from "react-native-track-player";

import { getLocalPath, downloadTrack } from "@/lib/downloads";
import {
  PlayerProvider,
  usePlayerActions,
  usePlayerPrefs,
  usePlayerProgress,
} from "@/lib/player-context";

describe("usePlayerActions identity stability", () => {
  it("keeps the same actions object across an unrelated state change", () => {
    const seenActions: unknown[] = [];
    let bumpVolume: ((v: number) => void) | null = null;

    function Probe() {
      const actions = usePlayerActions();
      const { volume } = usePlayerPrefs();
      seenActions.push(actions);
      bumpVolume = actions.setVolume;
      return <Text>{String(volume)}</Text>;
    }

    render(
      <PlayerProvider>
        <Probe />
      </PlayerProvider>,
    );

    const before = seenActions.length;
    act(() => {
      bumpVolume?.(0.4);
    });

    // The volume change must have actually re-rendered the probe (otherwise
    // this test would pass vacuously)...
    expect(seenActions.length).toBeGreaterThan(before);
    // ...yet every actions object handed out is the very same reference, so a
    // consumer reading ONLY actions is never re-rendered by it.
    expect(new Set(seenActions).size).toBe(1);
  });
});

describe("progress tick containment", () => {
  const progressMock = useProgress as unknown as jest.Mock;
  const playbackStateMock = usePlaybackState as unknown as jest.Mock;
  const originalProgress = progressMock.getMockImplementation();

  afterEach(() => {
    progressMock.mockImplementation(originalProgress);
  });

  it("re-renders only the progress consumer, not PlayerProvider itself", () => {
    // Drive the 250ms tick from real state so `act()` can advance it. The
    // useState lives in whichever component calls useProgress — which is
    // exactly the boundary under test.
    let tick: ((p: number) => void) | null = null;
    progressMock.mockImplementation(() => {
      const [position, setPosition] = React.useState(0);
      tick = setPosition;
      return { position, duration: 100, buffered: 0 };
    });

    let probeRenders = 0;
    function ProgressProbe() {
      probeRenders += 1;
      const { currentTime } = usePlayerProgress();
      return <Text>{String(currentTime)}</Text>;
    }

    render(
      <PlayerProvider>
        <ProgressProbe />
      </PlayerProvider>,
    );

    // `usePlaybackState` is called from PlayerProvider's own body and nowhere
    // else, so its call count is a direct probe of "did the provider re-render".
    const providerRendersBefore = playbackStateMock.mock.calls.length;
    const probeRendersBefore = probeRenders;

    act(() => {
      tick?.(42);
    });

    // The tick must actually have propagated (otherwise this passes vacuously)…
    expect(probeRenders).toBeGreaterThan(probeRendersBefore);
    // …while PlayerProvider's body did NOT re-run. Regressing this puts
    // `useProgress` back in the provider, re-running all five context memos
    // 4×/sec for the whole of playback and starving navigation on the JS thread.
    expect(playbackStateMock.mock.calls.length).toBe(providerRendersBefore);
  });
});

describe("getLocalPath filesystem access", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("answers null for an undownloaded track without stat-ing the filesystem", async () => {
    // Warm the index with a real record so the fast path has something to miss
    // against — this mirrors a session where the user has some downloads.
    await downloadTrack({
      id: "downloaded-1",
      title: "Downloaded",
      srcUrl: "https://cdn.example.com/a.mp3",
    });

    const existsSpy = jest.spyOn(FSFile.prototype, "exists", "get");
    existsSpy.mockClear();

    // A streamed Quran ayah: never downloaded. This runs on every track
    // advance, so it must not touch the filesystem.
    expect(await getLocalPath("quran:2:255")).toBeNull();
    expect(existsSpy).not.toHaveBeenCalled();

    existsSpy.mockRestore();
  });

  it("stats a downloaded track once, then serves the cached uri", async () => {
    await downloadTrack({
      id: "downloaded-2",
      title: "Downloaded",
      srcUrl: "https://cdn.example.com/b.mp3",
    });

    const existsSpy = jest.spyOn(FSFile.prototype, "exists", "get");
    existsSpy.mockClear();

    const first = await getLocalPath("downloaded-2");
    const statsAfterFirst = existsSpy.mock.calls.length;
    const second = await getLocalPath("downloaded-2");

    expect(first).toBeTruthy();
    expect(second).toBe(first);
    // Repeat loads of the same track add no further stat calls.
    expect(existsSpy.mock.calls.length).toBe(statsAfterFirst);

    existsSpy.mockRestore();
  });
});
