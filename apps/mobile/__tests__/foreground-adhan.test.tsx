import { act, render } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { createAudioPlayer } from "expo-audio";

import { useForegroundAdhan } from "@/features/prayer-times/hooks/use-foreground-adhan";
import { PlayerProvider } from "@/lib/player-context";

let latest: ReturnType<typeof useForegroundAdhan> | null = null;

function Harness() {
  latest = useForegroundAdhan();
  return null;
}

function renderHook() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PlayerProvider>
        <Harness />
      </PlayerProvider>
    </QueryClientProvider>,
  );
}

// Pull the callback handed to addNotificationReceivedListener so we can fire a
// fake notification at it.
function getListener(): (n: unknown) => void {
  const calls = jest.mocked(Notifications.addNotificationReceivedListener).mock.calls;
  return calls[calls.length - 1]![0] as (n: unknown) => void;
}

function notif(identifier: string) {
  return { request: { identifier } };
}

describe("useForegroundAdhan", () => {
  beforeEach(() => {
    jest.mocked(createAudioPlayer).mockClear();
    jest.mocked(Notifications.addNotificationReceivedListener).mockClear();
  });

  it("plays the regular adhan when an azan notification fires in the foreground", () => {
    renderHook();
    getListener()(notif("nour-azan-0-dhuhr"));

    expect(createAudioPlayer).toHaveBeenCalledTimes(1);
    const player = jest.mocked(createAudioPlayer).mock.results[0]!.value;
    expect(player.replace).toHaveBeenCalledWith({
      uri: "http://localhost:3000/audio/adhan.mp3",
    });
    expect(player.play).toHaveBeenCalled();
  });

  it("uses the Fajr recording for the fajr notification", () => {
    renderHook();
    getListener()(notif("nour-azan-1-fajr"));

    const player = jest.mocked(createAudioPlayer).mock.results[0]!.value;
    expect(player.replace).toHaveBeenCalledWith({
      uri: "http://localhost:3000/audio/adhan-fajr.mp3",
    });
  });

  it("ignores notifications that are not azan", () => {
    renderHook();
    getListener()(notif("nour-azkar-0-sabah"));
    expect(createAudioPlayer).not.toHaveBeenCalled();
  });

  it("exposes the firing prayer as activeKey, cleared by stop()", () => {
    renderHook();
    act(() => getListener()(notif("nour-azan-0-dhuhr")));
    expect(latest?.activeKey).toBe("dhuhr");

    const player = jest.mocked(createAudioPlayer).mock.results[0]!.value;
    act(() => latest!.stop());
    expect(player.pause).toHaveBeenCalled();
    expect(latest?.activeKey).toBeNull();
  });

  it("clears activeKey when the adhan finishes on its own", () => {
    renderHook();
    act(() => getListener()(notif("nour-azan-0-dhuhr")));

    const player = jest.mocked(createAudioPlayer).mock.results[0]!.value;
    const onStatusUpdate = player.addListener.mock.calls[0][1];
    act(() => onStatusUpdate({ didJustFinish: true }));
    expect(latest?.activeKey).toBeNull();
  });
});
