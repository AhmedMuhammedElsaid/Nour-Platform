import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadPrayerMonth,
  resolveDayFrom,
  resolvePrayerDay,
  type PrayerDayParams,
} from "./aladhan";

// In-memory browser.storage.local (the vitest setup proxies the polyfill to
// globalThis.chrome). String-key get returns { [key]: value }, object set merges.
const store = new Map<string, unknown>();
const storageLocal = {
  get: vi.fn(async (key: string) => ({ [key]: store.get(key) })),
  set: vi.fn(async (items: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(items)) store.set(k, v);
  }),
};
vi.stubGlobal("chrome", {
  storage: {
    local: storageLocal,
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
});

const FAJR_ISO = "2026-10-29T05:39:00+03:00";
const FAJR_EPOCH = Date.UTC(2026, 9, 29, 2, 39, 0);

const PARAMS: PrayerDayParams = {
  lat: 30.0444,
  lng: 31.2357,
  method: "Egyptian",
  madhab: "standard",
  date: new Date(2026, 9, 29, 12, 0, 0),
};

function mockAladhanFetch() {
  const fn = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      code: 200,
      data: [
        {
          timings: {
            Fajr: FAJR_ISO,
            Sunrise: "2026-10-29T07:00:00+03:00",
            Dhuhr: "2026-10-29T12:00:00+03:00",
            Asr: "2026-10-29T15:00:00+03:00",
            Maghrib: "2026-10-29T18:00:00+03:00",
            Isha: "2026-10-29T19:30:00+03:00",
          },
          date: { gregorian: { day: "29", month: { number: 10 }, year: "2026" } },
        },
      ],
    }),
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("extension aladhan glue", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // re-stub chrome for the next test (unstubAllGlobals removes it too)
    vi.stubGlobal("chrome", {
      storage: {
        local: storageLocal,
        onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    });
  });

  it("resolvePrayerDay fetches iso8601=true, persists a v2 key, and returns the absolute Fajr epoch", async () => {
    const fetchMock = mockAladhanFetch();

    const day = await resolvePrayerDay(PARAMS);

    expect(String(fetchMock.mock.calls[0]![0])).toContain("iso8601=true");
    const fajr = day.instants.find((i) => i.key === "fajr");
    expect(fajr?.time?.getTime()).toBe(FAJR_EPOCH);
    expect(
      [...store.keys()].some((k) => k.startsWith("nour.prayer.calendar.v2.")),
    ).toBe(true);
  });

  it("does not re-fetch when the month is already cached", async () => {
    const fetchMock = mockAladhanFetch();
    await resolvePrayerDay(PARAMS);
    await resolvePrayerDay(PARAMS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to adhan-js on fetch failure and backoff-gates the retry for the same key", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);

    const day = await resolvePrayerDay(PARAMS);
    expect(day.instants.every((i) => i.time != null)).toBe(true); // adhan-js fallback

    await resolvePrayerDay(PARAMS); // 1-min tick calls again while offline
    expect(fetchMock).toHaveBeenCalledTimes(1); // gated, not hammered
  });

  it("a different cache key (new city) bypasses the failure backoff immediately", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);

    await resolvePrayerDay(PARAMS);
    await resolvePrayerDay({ ...PARAMS, lat: 24.7136, lng: 46.6753 }); // Riyadh
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("resolveDayFrom resolves synchronously from a loaded month and falls back when cold", async () => {
    mockAladhanFetch();
    await resolvePrayerDay(PARAMS); // warm the cache
    const month = await loadPrayerMonth(PARAMS);

    const warm = resolveDayFrom(month, PARAMS);
    expect(warm.instants.find((i) => i.key === "fajr")?.time?.getTime()).toBe(
      FAJR_EPOCH,
    );

    const cold = resolveDayFrom(null, PARAMS);
    expect(cold.instants.every((i) => i.time != null)).toBe(true); // adhan-js
  });
});
