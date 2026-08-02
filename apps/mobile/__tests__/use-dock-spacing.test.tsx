import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Text, View } from "react-native";

import { TAB_BAR_HEIGHT } from "@/components/bottom-tab-bar";
import { MINI_PLAYER_HEIGHT } from "@/components/mini-player";
import { PlayerProvider, usePlayerActions } from "@/lib/player-context";
import type { QueueTrack } from "@/lib/player-context";
import { useDockSpacing } from "@/lib/use-dock-spacing";

// jest.setup.js mocks react-native-safe-area-context with zero insets, so the
// expected value here is BASE_GAP(8) + TAB_BAR_HEIGHT + (queue ? MINI_PLAYER_HEIGHT : 0).
const BASE_GAP = 8;

const sampleQueue: QueueTrack[] = [
  { id: "t1", title: "Track 1", mediaUrl: "https://example.com/1.mp3" },
];

function Probe() {
  const spacing = useDockSpacing();
  const { loadQueue, stop } = usePlayerActions();
  return (
    <View>
      <Text testID="spacing">{String(spacing)}</Text>
      <View testID="load" onTouchEnd={() => loadQueue(sampleQueue, 0)} />
      <View testID="stop" onTouchEnd={() => stop()} />
    </View>
  );
}

function renderProbe() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <PlayerProvider>
        <Probe />
      </PlayerProvider>
    </QueryClientProvider>,
  );
}

describe("useDockSpacing", () => {
  it("reserves the tab bar alone when no queue is loaded", () => {
    renderProbe();
    expect(screen.getByTestId("spacing").children.join("")).toBe(
      String(BASE_GAP + TAB_BAR_HEIGHT),
    );
  });

  it("adds the mini-player height once a queue is loaded, and drops it again on stop", () => {
    renderProbe();
    fireEvent(screen.getByTestId("load"), "touchEnd");
    expect(screen.getByTestId("spacing").children.join("")).toBe(
      String(BASE_GAP + TAB_BAR_HEIGHT + MINI_PLAYER_HEIGHT),
    );

    fireEvent(screen.getByTestId("stop"), "touchEnd");
    expect(screen.getByTestId("spacing").children.join("")).toBe(
      String(BASE_GAP + TAB_BAR_HEIGHT),
    );
  });
});
