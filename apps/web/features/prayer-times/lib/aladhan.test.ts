import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cachedPrayerDay, ensurePrayerMonth, resolvePrayerDay } from "./aladhan";

const LAT = 30.0444;
const LNG = 31.2357;
const METHOD = "Egyptian" as const;
const MADHAB = "standard" as const;
const DATE = new Date(2026, 9, 29); // 2026-10-29 (local)

// Fajr 05:39 at UTC+3 = 02:39 UTC — Cairo's Aladhan offset for late Oct 2026.
const FAJR_ISO = "2026-10-29T05:39:00+03:00";
const FAJR_EPOCH = Date.UTC(2026, 9, 29, 2, 39, 0);

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

describe("web aladhan glue", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ensurePrayerMonth requests iso8601=true and persists under a v2 cache key", async () => {
    const fetchMock = mockAladhanFetch();

    await ensurePrayerMonth({ lat: LAT, lng: LNG, method: METHOD, madhab: MADHAB, date: DATE });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requested = String(fetchMock.mock.calls[0]![0]);
    expect(requested).toContain("iso8601=true");

    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith("nour.prayer.calendar.v2."),
    );
    expect(keys).toHaveLength(1);
  });

  it("cachedPrayerDay returns the absolute Fajr epoch once the month is warm", async () => {
    mockAladhanFetch();
    await ensurePrayerMonth({ lat: LAT, lng: LNG, method: METHOD, madhab: MADHAB, date: DATE });

    const day = cachedPrayerDay({ lat: LAT, lng: LNG, method: METHOD, madhab: MADHAB, date: DATE });
    const fajr = day?.instants.find((i) => i.key === "fajr");
    expect(fajr?.time?.getTime()).toBe(FAJR_EPOCH);
  });

  it("resolvePrayerDay falls back to computePrayerTimes on a cold cache without fetching", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const day = resolvePrayerDay({ lat: LAT, lng: LNG, method: METHOD, madhab: MADHAB, date: DATE });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(day.instants.every((i) => i.time != null)).toBe(true);
  });
});
