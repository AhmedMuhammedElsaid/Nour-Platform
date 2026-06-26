import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ADHAN_SETTINGS,
  DEFAULT_LOCATION,
} from "@repo/api/schemas/prayer-times";

vi.mock("@repo/api/services/prayer-times", () => ({
  computePrayerTimes: vi.fn(),
}));

import { computePrayerTimes } from "@repo/api/services/prayer-times";

import { useAdhanScheduler } from "./use-adhan-scheduler";

const mockedCompute = vi.mocked(computePrayerTimes);
const prefs = { method: "Egyptian", madhab: "standard" } as const;

type Overrides = Partial<Record<string, Date | null>>;

// Minimal PrayerDay shape — the scheduler only reads `day.instants`.
function dayWith(overrides: Overrides) {
  const order = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"] as const;
  return {
    date: new Date(),
    instants: order.map((key) => ({ key, time: overrides[key] ?? null })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub
  } as any;
}

function Harness({ onFire }: { onFire: (event: { key: string }) => void }) {
  useAdhanScheduler({
    settings: DEFAULT_ADHAN_SETTINGS,
    location: DEFAULT_LOCATION,
    prefs,
    enabled: true,
    onFire,
  });
  return null;
}

describe("useAdhanScheduler", () => {
  beforeEach(() => {
    localStorage.clear();
    mockedCompute.mockReset();
  });

  it("does NOT play a just-passed adhan when the tab is opened/focused", async () => {
    const now = Date.now();
    mockedCompute.mockReturnValue(
      dayWith({
        dhuhr: new Date(now - 30_000), // passed 30s ago (inside old catch-up window)
        asr: new Date(now + 10 * 60_000), // keeps a future event to arm
      }),
    );
    const onFire = vi.fn();
    render(<Harness onFire={onFire} />);

    // Simulate opening the site / returning to the tab.
    act(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Wait past the fired-claim settle window (120ms).
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(onFire).not.toHaveBeenCalled();
  });

  it("fires exactly once when the prayer instant arrives", async () => {
    const now = Date.now();
    mockedCompute.mockReturnValue(dayWith({ dhuhr: new Date(now + 200) }));
    const onFire = vi.fn();
    render(<Harness onFire={onFire} />);

    await waitFor(() => expect(onFire).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    });
    expect(onFire.mock.calls[0]![0].key).toBe("dhuhr");
  });
});
