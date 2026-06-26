import { buildAdhanInstants } from "@/features/prayer-times/hooks/use-azan-notifications";
import { getPrayerDay } from "@/features/prayer-times/lib/aladhan";
import {
  prayerLocationSchema,
  prayerPreferencesSchema,
} from "@repo/shared-core/schemas/prayer-times";
import type { PrayerDay, PrayerKey } from "@repo/shared-core/prayer-times/compute";

jest.mock("@/features/prayer-times/lib/aladhan", () => ({
  getPrayerDay: jest.fn(),
}));

// Fixed daily clock for the mocked calendar (local time).
const ORDER: [PrayerKey, number, number][] = [
  ["fajr", 4, 0],
  ["sunrise", 5, 30],
  ["dhuhr", 12, 0],
  ["asr", 15, 30],
  ["maghrib", 19, 0],
  ["isha", 20, 30],
];

function dayFor(date: Date): PrayerDay {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  return {
    date: new Date(y, m, d),
    instants: ORDER.map(([key, h, min]) => ({ key, time: new Date(y, m, d, h, min, 0, 0) })),
  };
}

const location = prayerLocationSchema.parse({ lat: 30, lng: 31, label: "Cairo", cityId: "cairo" });
const prefs = prayerPreferencesSchema.parse({});
// Asr disabled to prove per-prayer toggles are honoured.
const perPrayer = { fajr: true, dhuhr: true, asr: false, maghrib: true, isha: true };

describe("buildAdhanInstants", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 5, 26, 10, 0, 0)); // 2026-06-26 10:00 local
    jest
      .mocked(getPrayerDay)
      .mockImplementation(async (_lat, _lng, _method, _madhab, date) => dayFor(date));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("drops sunrise, past times, and per-prayer-disabled prayers across today+tomorrow", async () => {
    const items = await buildAdhanInstants(location, prefs, perPrayer);

    expect(items.map((i) => i.id)).toEqual([
      "nour-azan-0-dhuhr",
      "nour-azan-0-maghrib",
      "nour-azan-0-isha",
      "nour-azan-1-fajr",
      "nour-azan-1-dhuhr",
      "nour-azan-1-maghrib",
      "nour-azan-1-isha",
    ]);
  });

  it("never includes sunrise or a disabled prayer, and flags only fajr", async () => {
    const items = await buildAdhanInstants(location, prefs, perPrayer);

    expect(items.some((i) => i.key === ("sunrise" as PrayerKey))).toBe(false);
    expect(items.some((i) => i.key === "asr")).toBe(false);
    expect(items.find((i) => i.key === "fajr")?.fajr).toBe(true);
    expect(items.find((i) => i.key === "dhuhr")?.fajr).toBe(false);
  });

  it("only schedules tomorrow once today's prayers are all past", async () => {
    jest.setSystemTime(new Date(2026, 5, 26, 23, 59, 0)); // after today's Isha
    const items = await buildAdhanInstants(location, prefs, perPrayer);
    expect(items.map((i) => i.id)).toEqual([
      "nour-azan-1-fajr",
      "nour-azan-1-dhuhr",
      "nour-azan-1-maghrib",
      "nour-azan-1-isha",
    ]);
  });
});
