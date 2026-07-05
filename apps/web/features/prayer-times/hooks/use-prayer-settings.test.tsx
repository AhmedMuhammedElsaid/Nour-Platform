import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePrayerSettings } from "./use-prayer-settings";

const LOCATION_KEY = "nour.prayer.location";
const ASKED_KEY = "nour.prayer.locationAsked";

// Riyadh — the reported failing case (user saw Cairo default instead).
const RIYADH = { latitude: 24.7136, longitude: 46.6753 };

function mockGeolocation(impl: typeof navigator.geolocation.getCurrentPosition) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: impl },
  });
}

describe("usePrayerSettings first-visit geolocation", () => {
  beforeEach(() => {
    localStorage.clear();
    // getCurrentPosition requires a secure context.
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("auto-detects the device location on first visit and persists it", async () => {
    mockGeolocation((success) => success({ coords: RIYADH } as GeolocationPosition));

    const { result } = renderHook(() => usePrayerSettings());

    await waitFor(() => expect(result.current.location.cityId).toBe("riyadh"));
    expect(result.current.location.label).toBe("Riyadh");
    // Persisted so later loads skip the default.
    expect(JSON.parse(localStorage.getItem(LOCATION_KEY)!).cityId).toBe("riyadh");
    expect(localStorage.getItem(ASKED_KEY)).toBe("1");
  });

  it("keeps the default and never re-prompts when permission is denied", async () => {
    const getCurrentPosition = vi.fn((_success, error?: PositionErrorCallback) =>
      error?.({ code: 1 } as GeolocationPositionError),
    );
    mockGeolocation(getCurrentPosition);

    const { result } = renderHook(() => usePrayerSettings());

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.location.cityId).toBe("cairo"); // DEFAULT_LOCATION
    // Flag set so subsequent loads don't ask again.
    expect(localStorage.getItem(ASKED_KEY)).toBe("1");
  });

  it("does not geolocate when a location is already stored", async () => {
    localStorage.setItem(
      LOCATION_KEY,
      JSON.stringify({ lat: 24.7136, lng: 46.6753, label: "Riyadh", cityId: "riyadh" }),
    );
    const getCurrentPosition = vi.fn();
    mockGeolocation(getCurrentPosition);

    const { result } = renderHook(() => usePrayerSettings());

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(result.current.location.cityId).toBe("riyadh");
  });
});
