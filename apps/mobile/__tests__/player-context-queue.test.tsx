// Scoped to the RNTP native multi-track queue rework (player-context.tsx +
// lib/native-queue.ts) — the fix for the audible pause between ayahs/tracks.
// Ordinary auto-advance now flows through Event.PlaybackActiveTrackChanged
// onto a track RNTP already had prebuffered; the old reset()+add(single)
// load path only runs for manual actions and true end-of-queue. The
// regression this file exists to guard: TrackPlayer.reset() must NEVER be
// called again just because playback advanced onto an already-native-loaded
// track — that would reintroduce the exact gap this phase removes.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text, View } from "react-native";
import TrackPlayer, { Event, useTrackPlayerEvents } from "react-native-track-player";

import { getLocalPath } from "@/lib/downloads";
import { PlayerProvider, usePlayer } from "@/lib/player-context";
import type { QueueTrack } from "@/lib/player-context";
import { setUserWantsPlayback } from "@/lib/playback-intent";

jest.mock("@/lib/downloads", () => {
  const actual = jest.requireActual("@/lib/downloads");
  return { ...actual, getLocalPath: jest.fn().mockResolvedValue(null) };
});

const fourTrackQueue: QueueTrack[] = [
  { id: "t1", title: "Track 1", mediaUrl: "https://x/1.mp3" },
  { id: "t2", title: "Track 2", mediaUrl: "https://x/2.mp3" },
  { id: "t3", title: "Track 3", mediaUrl: "https://x/3.mp3" },
  { id: "t4", title: "Track 4", mediaUrl: "https://x/4.mp3" },
];

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
      <View testID="load-4" onTouchEnd={() => player.loadQueue(fourTrackQueue, 0)} />
      <View testID="load-live" onTouchEnd={() => player.loadQueue([liveTrack], 0)} />
      <View testID="cycle-repeat" onTouchEnd={() => player.cycleRepeat()} />
      <View testID="sleep-end" onTouchEnd={() => player.setSleepTimer("end-of-track")} />
      <Text testID="current">{player.currentTrack?.title ?? "none"}</Text>
      <Text testID="repeat-mode">{player.repeatMode}</Text>
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

// Flush the async mount effects (setupPlayer, adopt(), the load effect) and
// any pending microtasks under fake timers — same recipe as the session and
// retry suites for this same provider.
async function flush(): Promise<void> {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
}

// jest.setup.js mocks useTrackPlayerEvents as a bare jest.fn() that never
// invokes its callback on its own — pull the one registered for
// PlaybackActiveTrackChanged so tests can fire a fake native-advance event at
// it directly, the same trick player-context-retry.test.tsx uses for
// PlaybackError.
function getActiveTrackChangedHandler(): (event: unknown) => void {
  const calls = jest.mocked(useTrackPlayerEvents).mock.calls;
  for (let i = calls.length - 1; i >= 0; i -= 1) {
    const [events, cb] = calls[i]!;
    if (Array.isArray(events) && events.includes(Event.PlaybackActiveTrackChanged)) {
      return cb as (event: unknown) => void;
    }
  }
  throw new Error("PlaybackActiveTrackChanged handler was not registered");
}

describe("RNTP native-queue lookahead", () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    // cycleRepeat/toggleShuffle persist prefs to (mocked) AsyncStorage — clear
    // it each test so one test's repeat/shuffle mode doesn't hydrate into the
    // next test's fresh PlayerProvider mount.
    await AsyncStorage.clear();
    jest.mocked(getLocalPath).mockResolvedValue(null);
    setUserWantsPlayback(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("loads the active track plus a NATIVE_QUEUE_LOOKAHEAD-deep window on loadQueue", async () => {
    renderHarness();
    await flush();
    fireEvent(screen.getByTestId("load-4"), "touchEnd");
    await flush();

    expect(TrackPlayer.add).toHaveBeenCalledTimes(1);
    const added = jest.mocked(TrackPlayer.add).mock.calls[0]?.[0] as unknown as { id: string }[];
    expect(Array.isArray(added)).toBe(true);
    expect(added.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
  });

  it("never queues a lookahead for a single live track", async () => {
    renderHarness();
    await flush();
    fireEvent(screen.getByTestId("load-live"), "touchEnd");
    await flush();

    expect(TrackPlayer.add).toHaveBeenCalledTimes(1);
    const added = jest.mocked(TrackPlayer.add).mock.calls[0]?.[0] as unknown as { id: string }[];
    expect(added).toHaveLength(1);
    expect(added[0]?.id).toBe("radio-1");
  });

  it("advances currentIndex on PlaybackActiveTrackChanged WITHOUT calling TrackPlayer.reset again", async () => {
    renderHarness();
    await flush();
    fireEvent(screen.getByTestId("load-4"), "touchEnd");
    await flush();
    jest.mocked(TrackPlayer.reset).mockClear();

    getActiveTrackChangedHandler()({
      index: 1,
      track: { id: "t2" },
      lastTrack: { id: "t1" },
    });
    await flush();

    expect(screen.getByTestId("current").props.children).toBe("Track 2");
    expect(TrackPlayer.reset).not.toHaveBeenCalled();
  });

  it("tops up exactly the newly-revealed track on advance, never re-adding an already-native one", async () => {
    renderHarness();
    await flush();
    fireEvent(screen.getByTestId("load-4"), "touchEnd");
    await flush();
    jest.mocked(TrackPlayer.add).mockClear();

    getActiveTrackChangedHandler()({
      index: 1,
      track: { id: "t2" },
      lastTrack: { id: "t1" },
    });
    await flush();

    // Window was [t1,t2,t3]; advancing onto t2 should top up ONLY t4 (t3 is
    // already native-side) — never re-add t3.
    expect(TrackPlayer.add).toHaveBeenCalledTimes(1);
    const topUp = jest.mocked(TrackPlayer.add).mock.calls[0]?.[0] as unknown as { id: string }[];
    expect(topUp.map((t) => t.id)).toEqual(["t4"]);
  });

  it("queues no lookahead in repeat-one mode", async () => {
    renderHarness();
    await flush();
    fireEvent(screen.getByTestId("cycle-repeat"), "touchEnd"); // off -> all
    fireEvent(screen.getByTestId("cycle-repeat"), "touchEnd"); // all -> one
    await flush();
    expect(screen.getByTestId("repeat-mode").props.children).toBe("one");
    jest.mocked(TrackPlayer.add).mockClear();

    fireEvent(screen.getByTestId("load-4"), "touchEnd");
    await flush();

    const added = jest.mocked(TrackPlayer.add).mock.calls[0]?.[0] as unknown as { id: string }[];
    expect(added).toHaveLength(1);
    expect(added[0]?.id).toBe("t1");
  });

  it("trims the native queue to the current track when sleep end-of-track is armed", async () => {
    renderHarness();
    await flush();
    fireEvent(screen.getByTestId("load-4"), "touchEnd");
    await flush();
    jest.mocked(TrackPlayer.removeUpcomingTracks).mockClear();

    fireEvent(screen.getByTestId("sleep-end"), "touchEnd");
    await flush();

    expect(TrackPlayer.removeUpcomingTracks).toHaveBeenCalled();
  });

  it("uses the local downloaded file for an upcoming track when offline", async () => {
    jest.mocked(getLocalPath).mockImplementation(async (id: string) =>
      id === "t2" ? "/local/t2.mp3" : null,
    );

    renderHarness();
    await flush();
    fireEvent(screen.getByTestId("load-4"), "touchEnd");
    await flush();

    const added = jest.mocked(TrackPlayer.add).mock.calls[0]?.[0] as unknown as {
      id: string;
      url: string;
    }[];
    expect(added.find((t) => t.id === "t2")?.url).toBe("/local/t2.mp3");
    expect(added.find((t) => t.id === "t1")?.url).toBe("https://x/1.mp3");
  });
});
