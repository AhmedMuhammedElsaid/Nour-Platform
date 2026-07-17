import AsyncStorage from "@react-native-async-storage/async-storage";

import { getPrayerDay } from "@/features/prayer-times/lib/aladhan";

const LAT = 30.0444;
const LNG = 31.2357;
const METHOD = "Egyptian";
const MADHAB = "standard";
const DATE = new Date(2026, 9, 29); // 2026-10-29 (local)

// Fajr 05:39 at UTC+3 = 02:39 UTC — Cairo's Aladhan offset for late Oct 2026.
const FAJR_ISO = "2026-10-29T05:39:00+03:00";
const FAJR_EPOCH = Date.UTC(2026, 9, 29, 2, 39, 0);

function aladhanBody() {
  return {
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
  };
}

describe("mobile getPrayerDay", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  it("fetches iso8601=true and returns the absolute Fajr epoch", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => aladhanBody(),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const day = await getPrayerDay(LAT, LNG, METHOD, MADHAB, DATE);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requested = String(fetchMock.mock.calls[0]![0]);
    expect(requested).toContain("iso8601=true");
    const fajr = day.instants.find((i) => i.key === "fajr");
    expect(fajr?.time?.getTime()).toBe(FAJR_EPOCH);
  });

  it("does not re-fetch on a second call for the same cached month", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => aladhanBody(),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await getPrayerDay(LAT, LNG, METHOD, MADHAB, DATE);
    await getPrayerDay(LAT, LNG, METHOD, MADHAB, DATE);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to computePrayerTimes (non-null instants, no throw) when fetch rejects", async () => {
    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(new Error("network")) as unknown as typeof fetch;

    const day = await getPrayerDay(LAT, LNG, METHOD, MADHAB, DATE);

    expect(day.instants.some((i) => i.time != null)).toBe(true);
  });
});
