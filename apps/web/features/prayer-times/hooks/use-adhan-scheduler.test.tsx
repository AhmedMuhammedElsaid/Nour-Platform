import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import {
  DEFAULT_ADHAN_SETTINGS,
  DEFAULT_LOCATION,
  type AdhanSettings,
} from "@repo/api/schemas/prayer-times";
import { computePrayerTimes } from "@repo/api/services/prayer-times";

import { useAdhanScheduler } from "./use-adhan-scheduler";

const SETTINGS: AdhanSettings = { ...DEFAULT_ADHAN_SETTINGS, enabled: true };
const PREFS = { method: "Egyptian", madhab: "standard" } as const;

function cairoFajr(): Date {
  const day = computePrayerTimes({
    lat: DEFAULT_LOCATION.lat,
    lng: DEFAULT_LOCATION.lng,
    date: new Date("2026-06-10T09:00:00Z"),
    method: PREFS.method,
    madhab: PREFS.madhab,
  });
  return day.instants.find((i) => i.key === "fajr")!.time as Date;
}

function renderScheduler(onFire: (e: { key: string; time: Date }) => void) {
  return renderHook(() =>
    useAdhanScheduler({
      settings: SETTINGS,
      location: DEFAULT_LOCATION,
      prefs: PREFS,
      enabled: true,
      onFire,
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useAdhanScheduler dedupe", () => {
  it("fires the fajr event exactly once when its time arrives", () => {
    const fajr = cairoFajr();
    vi.setSystemTime(new Date(fajr.getTime() - 10_000));
    const onFire = vi.fn();
    const hook = renderScheduler(onFire);

    act(() => {
      vi.advanceTimersByTime(11_000);
    });

    expect(onFire).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenCalledWith(
      expect.objectContaining({ key: "fajr" }),
    );
    hook.unmount();
  });

  it("does NOT refire after a reload (fresh hook) within the catch-up window", () => {
    const fajr = cairoFajr();
    vi.setSystemTime(new Date(fajr.getTime() - 10_000));
    const first = vi.fn();
    const hook1 = renderScheduler(first);
    act(() => {
      vi.advanceTimersByTime(11_000);
    });
    expect(first).toHaveBeenCalledTimes(1);
    hook1.unmount();

    // Simulate a page reload 30s after fajr: new hook instance, empty closure
    // state, then a focus event triggers the catch-up path.
    vi.setSystemTime(new Date(fajr.getTime() + 30_000));
    const second = vi.fn();
    const hook2 = renderScheduler(second);
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(second).not.toHaveBeenCalled();
    hook2.unmount();
  });

  it("still catches up a genuinely missed adhan (no prior fire recorded)", () => {
    const fajr = cairoFajr();
    // Tab loads fresh 30s after fajr — nothing ever fired for it.
    vi.setSystemTime(new Date(fajr.getTime() + 30_000));
    const onFire = vi.fn();
    const hook = renderScheduler(onFire);
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(onFire).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenCalledWith(
      expect.objectContaining({ key: "fajr" }),
    );
    hook.unmount();
  });
});
