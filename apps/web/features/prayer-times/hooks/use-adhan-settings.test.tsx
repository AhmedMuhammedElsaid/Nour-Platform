import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_ADHAN_SETTINGS } from "@repo/api/schemas/prayer-times";

import { useAdhanSettings } from "./use-adhan-settings";

describe("useAdhanSettings", () => {
  beforeEach(() => localStorage.clear());

  it("hydrates from defaults then reads localStorage", async () => {
    localStorage.setItem(
      "nour.prayer.adhan",
      JSON.stringify({ ...DEFAULT_ADHAN_SETTINGS, enabled: true, volume: 0.5 }),
    );
    const { result } = renderHook(() => useAdhanSettings());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.settings.enabled).toBe(true);
    expect(result.current.settings.volume).toBe(0.5);
  });

  it("persists updates back to localStorage", async () => {
    const { result } = renderHook(() => useAdhanSettings());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    act(() => result.current.setEnabled(true));
    expect(JSON.parse(localStorage.getItem("nour.prayer.adhan")!).enabled).toBe(true);
    act(() => result.current.setPrayer("fajr", false));
    expect(
      JSON.parse(localStorage.getItem("nour.prayer.adhan")!).perPrayer.fajr,
    ).toBe(false);
  });

  it("falls back to defaults on corrupt storage", async () => {
    localStorage.setItem("nour.prayer.adhan", "{ not json");
    const { result } = renderHook(() => useAdhanSettings());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.settings).toEqual(DEFAULT_ADHAN_SETTINGS);
  });
});
