import { Platform } from "react-native";
import {
  buildAdhanInstants,
  requestNotificationPermission,
  scheduleAzanNotifications,
  scheduleTestAzan,
} from "@/features/prayer-times/hooks/use-azan-notifications";
import * as AdhanNative from "@/lib/adhan-native";
import { getPrayerDay } from "@/features/prayer-times/lib/aladhan";
import {
  prayerLocationSchema,
  prayerPreferencesSchema,
} from "@repo/shared-core/schemas/prayer-times";
import type { PrayerDay, PrayerKey } from "@repo/shared-core/prayer-times/compute";
import * as Notifications from "expo-notifications";

jest.mock("@/features/prayer-times/lib/aladhan", () => ({
  getPrayerDay: jest.fn(),
}));

// Native adhan module: report "available" so the Android dispatch branch can be
// exercised. On the default jest platform (ios) nativeAdhanActive() is still false
// (it requires Platform.OS === "android"), so this doesn't affect the iOS-path tests.
jest.mock("@/lib/adhan-native", () => ({
  isNativeAdhanAvailable: jest.fn(() => true),
  scheduleAll: jest.fn().mockResolvedValue(undefined),
  cancelAll: jest.fn().mockResolvedValue(undefined),
  playTest: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
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
const prayerNames = { fajr: "Fajr", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };

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

  it("drops sunrise, past times, and per-prayer-disabled prayers; heads with today+tomorrow", async () => {
    const items = await buildAdhanInstants(location, prefs, perPrayer);

    // The head of the pool is today's remaining prayers then tomorrow's, in order.
    expect(items.slice(0, 7).map((i) => i.id)).toEqual([
      "nour-azan-0-dhuhr",
      "nour-azan-0-maghrib",
      "nour-azan-0-isha",
      "nour-azan-1-fajr",
      "nour-azan-1-dhuhr",
      "nour-azan-1-maghrib",
      "nour-azan-1-isha",
    ]);

    // Long pool (60-day HORIZON_DAYS): 3 remaining today (fajr already past at 10:00)
    // + 4 enabled prayers × 59 further days. Proves we build far beyond today+tomorrow.
    expect(items).toHaveLength(3 + 59 * 4);
    expect(items.some((i) => i.id === "nour-azan-59-fajr")).toBe(true);
    expect(items.some((i) => i.id.startsWith("nour-azan-60-"))).toBe(false);
  });

  it("never includes sunrise or a disabled prayer, and flags only fajr", async () => {
    const items = await buildAdhanInstants(location, prefs, perPrayer);

    expect(items.some((i) => i.key === ("sunrise" as PrayerKey))).toBe(false);
    expect(items.some((i) => i.key === "asr")).toBe(false);
    expect(items.find((i) => i.key === "fajr")?.fajr).toBe(true);
    expect(items.find((i) => i.key === "dhuhr")?.fajr).toBe(false);
  });

  it("skips today entirely once its prayers are all past (starts at tomorrow)", async () => {
    jest.setSystemTime(new Date(2026, 5, 26, 23, 59, 0)); // after today's Isha
    const items = await buildAdhanInstants(location, prefs, perPrayer);
    // No day-0 instants survive; the pool now heads with tomorrow's prayers.
    expect(items.some((i) => i.id.startsWith("nour-azan-0-"))).toBe(false);
    expect(items.slice(0, 4).map((i) => i.id)).toEqual([
      "nour-azan-1-fajr",
      "nour-azan-1-dhuhr",
      "nour-azan-1-maghrib",
      "nour-azan-1-isha",
    ]);
  });

  it("steps through 60 distinct, consecutive calendar dates (noon anchor)", async () => {
    await buildAdhanInstants(location, prefs, perPrayer);

    // getPrayerDay is called once per dayOffset regardless of instant count —
    // its `date` arg (5th positional) is the noon-anchored stepping date.
    const dateArgs = jest.mocked(getPrayerDay).mock.calls.map((c) => c[4]);
    expect(dateArgs).toHaveLength(60);

    const keys = dateArgs.map((d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    expect(new Set(keys).size).toBe(60); // no duplicate calendar date

    for (let i = 1; i < dateArgs.length; i++) {
      expect(dateArgs[i]!.getTime()).toBeGreaterThan(dateArgs[i - 1]!.getTime());
    }
  });
});

describe("scheduleAzanNotifications — platform dispatch", () => {
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

  it("iOS caps scheduled notifications at 40 (stays under the 64-notification OS limit)", async () => {
    // Default jest platform is ios → notification fallback path (native inactive).
    const pool = await buildAdhanInstants(location, prefs, perPrayer);
    expect(pool.length).toBeGreaterThan(40); // the cap must actually bite

    await scheduleAzanNotifications(location, prefs, prayerNames, perPrayer, 1);

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(40);
    expect(AdhanNative.scheduleAll).not.toHaveBeenCalled();
  });

  describe("android native path", () => {
    const originalOS = Platform.OS;
    beforeAll(() => {
      Platform.OS = "android";
    });
    afterAll(() => {
      Platform.OS = originalOS;
    });

    it("hands the FULL ~60-day pool to native, uncapped (native arms only a few, pools the rest)", async () => {
      const pool = await buildAdhanInstants(location, prefs, perPrayer);

      await scheduleAzanNotifications(location, prefs, prayerNames, perPrayer, 0.8);

      expect(AdhanNative.scheduleAll).toHaveBeenCalledTimes(1);
      const passed = jest.mocked(AdhanNative.scheduleAll).mock.calls[0]![0];
      expect(passed.length).toBe(pool.length); // whole pool, NOT sliced to 40
      expect(passed.length).toBeGreaterThan(40);
      expect(passed.every((i) => i.volume === 0.8)).toBe(true);
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });
});

// jest-expo's Platform.OS defaults to "ios", so the exported helpers below exercise
// the iOS notification path (nativeAdhanActive() is only ever true on android).
describe("iOS Critical Alerts", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("requests allowCriticalAlerts alongside the standard iOS permissions", async () => {
    await requestNotificationPermission();

    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledWith({
      ios: { allowAlert: true, allowSound: true, allowBadge: false, allowCriticalAlerts: true },
    });
  });

  it("schedules the test azan with interruptionLevel:critical and the bundled sound", async () => {
    await scheduleTestAzan("Test", 1.0);

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          sound: "adhan_notify.wav",
          interruptionLevel: "critical",
        }),
      }),
    );
  });
});
