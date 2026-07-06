// Scoped to the live-stream PlaybackError retry-gating fix (playback-intent.ts).
// Kept separate from player.test.tsx's general PlayerProvider suite so this
// file's fake-timer lifecycle doesn't affect those tests.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, fireEvent } from "@testing-library/react-native";
import { View } from "react-native";
import TrackPlayer, { Event, useTrackPlayerEvents } from "react-native-track-player";

import { PlayerProvider, usePlayer } from "@/lib/player-context";
import type { QueueTrack } from "@/lib/player-context";
import { setUserWantsPlayback } from "@/lib/playback-intent";

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
      <View testID="load-live" onTouchEnd={() => player.loadQueue([liveTrack], 0)} />
      <View testID="pause" onTouchEnd={() => player.pause()} />
      <View testID="retry" onTouchEnd={() => player.retry()} />
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

// jest.setup.js mocks useTrackPlayerEvents as a bare jest.fn() that never
// invokes its callback on its own — pull the one registered for PlaybackError
// so tests can fire a fake event at it directly. queueRef/currentIndexRef are
// refs (stable across renders), so any registered copy of the callback reads
// the same live state regardless of which render registered it.
function getPlaybackErrorHandler(): (event: unknown) => void {
  const calls = jest.mocked(useTrackPlayerEvents).mock.calls;
  for (let i = calls.length - 1; i >= 0; i -= 1) {
    const [events, cb] = calls[i]!;
    if (Array.isArray(events) && events.includes(Event.PlaybackError)) {
      return cb as (event: unknown) => void;
    }
  }
  throw new Error("PlaybackError handler was not registered");
}

// Loads the live track and flushes the async load() effect (setupPlayer →
// reset → add → setRate → play), then clears the resulting mock calls so
// later assertions only see calls caused by the test's own action.
async function loadLiveAndFlush(): Promise<void> {
  fireEvent(screen.getByTestId("load-live"), "touchEnd");
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  jest.mocked(TrackPlayer.seekTo).mockClear();
  jest.mocked(TrackPlayer.play).mockClear();
}

describe("live-stream PlaybackError retry gating", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    setUserWantsPlayback(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("auto-retries a live stream on PlaybackError while the user wants playback", async () => {
    renderHarness();
    await loadLiveAndFlush();

    getPlaybackErrorHandler()({ message: "network drop" });
    await jest.advanceTimersByTimeAsync(1000);

    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(TrackPlayer.play).toHaveBeenCalled();
  });

  it("does not resurrect playback after the user pauses a live stream", async () => {
    renderHarness();
    await loadLiveAndFlush();
    fireEvent(screen.getByTestId("pause"), "touchEnd");

    getPlaybackErrorHandler()({ message: "network drop" });
    await jest.advanceTimersByTimeAsync(5000);

    expect(TrackPlayer.seekTo).not.toHaveBeenCalled();
    expect(TrackPlayer.play).not.toHaveBeenCalled();
  });

  it("does not fire an already-armed retry timer if the user pauses during the backoff", async () => {
    renderHarness();
    await loadLiveAndFlush();

    // Error arms the retry timer FIRST…
    getPlaybackErrorHandler()({ message: "network drop" });
    // …then the user pauses inside the backoff window (before it fires).
    fireEvent(screen.getByTestId("pause"), "touchEnd");
    await jest.advanceTimersByTimeAsync(5000);

    expect(TrackPlayer.play).not.toHaveBeenCalled();
  });

  it("resumes retrying once the user presses retry after a pause", async () => {
    renderHarness();
    await loadLiveAndFlush();
    fireEvent(screen.getByTestId("pause"), "touchEnd");
    fireEvent(screen.getByTestId("retry"), "touchEnd");
    await jest.advanceTimersByTimeAsync(0);
    jest.mocked(TrackPlayer.seekTo).mockClear();
    jest.mocked(TrackPlayer.play).mockClear();

    getPlaybackErrorHandler()({ message: "network drop" });
    await jest.advanceTimersByTimeAsync(1000);

    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(TrackPlayer.play).toHaveBeenCalled();
  });
});
