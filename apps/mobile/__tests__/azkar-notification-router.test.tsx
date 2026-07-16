import { act, render } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";

import { useAzkarNotificationRouter } from "@/features/prayer-times/hooks/use-azkar-notification-router";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

function Harness() {
  useAzkarNotificationRouter();
  return null;
}

// Pull the callback handed to addNotificationResponseReceivedListener so we can
// fire a fake tap response at it.
function getListener(): (r: unknown) => void {
  const calls = jest.mocked(
    Notifications.addNotificationResponseReceivedListener,
  ).mock.calls;
  return calls[calls.length - 1]![0] as (r: unknown) => void;
}

const SLUG = "أذكار-الصباح";

function response(
  identifier: string,
  data: Record<string, unknown> | null,
  date = 1000,
) {
  return { notification: { date, request: { identifier, content: { data } } } };
}

const azkarResponse = (date = 1000) =>
  response("nour-azkar-0-sabah", { kind: "azkar-reminder", slug: SLUG }, date);

// Flush the getLastNotificationResponseAsync promise chain.
const flush = () => act(async () => {});

describe("useAzkarNotificationRouter", () => {
  beforeEach(() => {
    jest.mocked(router.push).mockClear();
    jest
      .mocked(Notifications.addNotificationResponseReceivedListener)
      .mockClear();
    jest
      .mocked(Notifications.getLastNotificationResponseAsync)
      .mockResolvedValue(null);
  });

  it("routes an azkar-reminder tap to the adhkar reader", async () => {
    render(<Harness />);
    await flush();

    act(() => getListener()(azkarResponse()));

    expect(router.push).toHaveBeenCalledWith(
      `/adhkar/${encodeURIComponent(SLUG)}`,
    );
  });

  it("ignores taps on other notifications (azan)", async () => {
    render(<Harness />);
    await flush();

    act(() => getListener()(response("nour-azan-0-dhuhr", null)));
    act(() =>
      getListener()(response("nour-azan-0-fajr", { kind: "azan" })),
    );

    expect(router.push).not.toHaveBeenCalled();
  });

  it("handles a cold-start tap via the last response, exactly once", async () => {
    const tap = azkarResponse();
    jest
      .mocked(Notifications.getLastNotificationResponseAsync)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValue(tap as any);

    render(<Harness />);
    await flush();

    // The same delivery may also arrive through the live listener on cold
    // start — it must not navigate twice.
    act(() => getListener()(tap));

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(
      `/adhkar/${encodeURIComponent(SLUG)}`,
    );
  });

  it("navigates again for a later reminder that reuses the identifier", async () => {
    render(<Harness />);
    await flush();

    act(() => getListener()(azkarResponse(1000)));
    act(() => getListener()(azkarResponse(2000)));

    expect(router.push).toHaveBeenCalledTimes(2);
  });
});
