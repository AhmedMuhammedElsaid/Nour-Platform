// Scoped to the now-playing session persistence + post-app-kill rehydration fix
// (player-context.tsx). After a force-close the native RNTP service survives (now
// paused, per appKilledPlaybackBehavior: PausePlayback) but the JS state is wiped;
// on reopen the provider must rehydrate the queue from the persisted session so the
// in-app player controls come back — WITHOUT reloading the already-loaded track.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text, View } from "react-native";
import TrackPlayer, { State } from "react-native-track-player";

import { PlayerProvider, usePlayer } from "@/lib/player-context";
import type { QueueTrack } from "@/lib/player-context";
import { setUserWantsPlayback } from "@/lib/playback-intent";

const SESSION_KEY = "nour.player.session";

const liveTrack: QueueTrack = {
  id: "radio-1",
  title: "Live Station",
  mediaUrl: "https://example.com/live.m3u8",
  isLive: true,
};

function TestConsumer() {
  const player = usePlayer();
  return (
    <View>
      <View
        testID="load-live"
        onTouchEnd={() => player.loadQueue([liveTrack], 0)}
      />
      <Text testID="current">{player.currentTrack?.title ?? "none"}</Text>
      <Text testID="has-queue">{player.hasQueue ? "yes" : "no"}</Text>
    </View>
  );
}

function renderHarness() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <PlayerProvider>
        <TestConsumer />
      </PlayerProvider>
    </QueryClientProvider>,
  );
}

// Flush the async mount effects (setupPlayer, adopt(), the load effect) and any
// pending microtasks under fake timers.
async function flush(): Promise<void> {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
}

describe("now-playing session persistence + rehydration", () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    await AsyncStorage.clear();
    setUserWantsPlayback(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Must be the first render in this file: setupPlayer() is module-idempotent, so
  // updateOptions is only invoked on the very first setup within the module's life.
  it("configures RNTP to pause playback when the app is force-closed", async () => {
    renderHarness();
    await flush();

    expect(TrackPlayer.updateOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        android: expect.objectContaining({
          appKilledPlaybackBehavior: "pause-playback",
        }),
      }),
    );
  });

  it("persists the now-playing session (with isLive) when a queue is loaded", async () => {
    renderHarness();
    await flush(); // let adopt() run so the persist effect is un-gated

    fireEvent(screen.getByTestId("load-live"), "touchEnd");
    await flush();

    const raw = await AsyncStorage.getItem(SESSION_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.index).toBe(0);
    expect(parsed.queue).toHaveLength(1);
    expect(parsed.queue[0].id).toBe("radio-1");
    expect(parsed.queue[0].isLive).toBe(true);
  });

  it("rehydrates a surviving session on reopen without restarting the stream", async () => {
    // Simulate the state after a force-close: session persisted, native player
    // still has the (now paused) track loaded at index 0.
    await AsyncStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ queue: [liveTrack], index: 0 }),
    );
    jest.mocked(TrackPlayer.getActiveTrackIndex).mockResolvedValueOnce(0);
    jest
      .mocked(TrackPlayer.getPlaybackState)
      .mockResolvedValueOnce({ state: State.Paused });

    renderHarness();
    await flush();

    // The in-app player is restored…
    expect(screen.getByTestId("has-queue").props.children).toBe("yes");
    expect(screen.getByTestId("current").props.children).toBe("Live Station");
    // …but the already-loaded native track is NOT reset/re-added (no restart).
    expect(TrackPlayer.reset).not.toHaveBeenCalled();
    expect(TrackPlayer.add).not.toHaveBeenCalled();
  });

  it("does not rehydrate on a cold start with no surviving native track", async () => {
    // Default mock: getActiveTrackIndex resolves undefined → nothing playing.
    await AsyncStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ queue: [liveTrack], index: 0 }),
    );

    renderHarness();
    await flush();

    // A stale session must NOT produce a phantom player when nothing is playing.
    expect(screen.getByTestId("has-queue").props.children).toBe("no");
    expect(screen.getByTestId("current").props.children).toBe("none");
  });
});
