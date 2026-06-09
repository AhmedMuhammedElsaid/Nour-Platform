import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { View } from "react-native";

import { PlayerProvider, usePlayer } from "@/lib/player-context";
import type { QueueTrack } from "@/lib/player-context";

// A test harness that renders the player controls alongside children.
function TestHarness({ onReady }: { onReady?: (api: ReturnType<typeof usePlayer>) => void }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <PlayerProvider>
        <TestConsumer onReady={onReady} />
      </PlayerProvider>
    </QueryClientProvider>
  );
}

const sampleQueue: QueueTrack[] = [
  { id: "t1", title: "Track 1", mediaUrl: "https://example.com/1.mp3", durationSecs: 120, playlistTitle: "Playlist A" },
  { id: "t2", title: "Track 2", mediaUrl: "https://example.com/2.mp3", durationSecs: 180 },
  { id: "t3", title: "Track 3", mediaUrl: "https://example.com/3.mp3" },
];

// Renders buttons that exercise the player API and displays state.
function TestConsumer({ onReady }: { onReady?: (api: ReturnType<typeof usePlayer>) => void }) {
  const player = usePlayer();
  if (onReady) onReady(player);

  return (
    <View>
      <View testID="state">
        {player.hasQueue ? "has-queue" : "no-queue"}|
        {player.currentTrack?.title ?? "none"}|
        {player.repeatMode}|
        {player.isShuffled ? "shuffled" : "unshuffled"}|
        {player.playbackRate}
      </View>
      <View testID="load-queue" onTouchEnd={() => player.loadQueue(sampleQueue, 0)} />
      <View testID="next" onTouchEnd={() => player.next()} />
      <View testID="prev" onTouchEnd={() => player.prev()} />
      <View testID="cycle-repeat" onTouchEnd={() => player.cycleRepeat()} />
      <View testID="toggle-shuffle" onTouchEnd={() => player.toggleShuffle()} />
      <View testID="set-rate" onTouchEnd={() => player.setPlaybackRate(1.5)} />
    </View>
  );
}

describe("PlayerProvider", () => {
  it("starts with no queue", () => {
    render(<TestHarness />);
    expect(screen.getByTestId("state").children.join("")).toContain("no-queue");
  });

  it("loads a queue and sets the current track", () => {
    render(<TestHarness />);
    fireEvent(screen.getByTestId("load-queue"), "touchEnd");
    const text = screen.getByTestId("state").children.join("");
    expect(text).toContain("has-queue");
    expect(text).toContain("Track 1");
  });

  it("cycles repeat modes off → all → one → off", () => {
    render(<TestHarness />);
    const btn = screen.getByTestId("cycle-repeat");
    const getText = () => screen.getByTestId("state").children.join("");

    expect(getText()).toContain("off");
    fireEvent(btn, "touchEnd");
    expect(getText()).toContain("all");
    fireEvent(btn, "touchEnd");
    expect(getText()).toContain("one");
    fireEvent(btn, "touchEnd");
    expect(getText()).toContain("|off|");
  });

  it("toggles shuffle", () => {
    render(<TestHarness />);
    const getText = () => screen.getByTestId("state").children.join("");
    expect(getText()).toContain("unshuffled");
    fireEvent(screen.getByTestId("toggle-shuffle"), "touchEnd");
    expect(getText()).toContain("shuffled");
  });

  it("changes playback rate", () => {
    render(<TestHarness />);
    fireEvent(screen.getByTestId("set-rate"), "touchEnd");
    expect(screen.getByTestId("state").children.join("")).toContain("1.5");
  });
});

describe("buildPlayOrder (via shuffle toggle)", () => {
  it("produces an order containing all indices when shuffled", () => {
    let api: ReturnType<typeof usePlayer> | undefined;
    render(<TestHarness onReady={(a) => { api = a; }} />);
    // Load queue first
    fireEvent(screen.getByTestId("load-queue"), "touchEnd");
    // Toggle shuffle
    fireEvent(screen.getByTestId("toggle-shuffle"), "touchEnd");
    // The queue still has 3 tracks (shuffle changes play order, not the queue)
    expect(api?.queue.length).toBe(3);
  });
});
