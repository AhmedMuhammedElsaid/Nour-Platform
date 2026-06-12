import { describe, expect, it } from "vitest";

import { DEFAULT_AZKAR_REMINDER_SETTINGS } from "@repo/api/schemas/prayer-times";
import type { PrayerInstant } from "@repo/api/services/prayer-times";

import {
  isAzkarReminderEventStale,
  nextAzkarReminderEvent,
  recentlyMissedAzkarReminder,
} from "./azkar-reminder-schedule";

function instants(): PrayerInstant[] {
  const d = (h: number, m = 0) => new Date(2026, 5, 7, h, m, 0, 0);
  return [
    { key: "fajr", time: d(4) },
    { key: "sunrise", time: d(6) },
    { key: "dhuhr", time: d(12) },
    { key: "asr", time: d(15) },
    { key: "maghrib", time: d(19) },
    { key: "isha", time: d(20, 30) },
  ];
}

const enabled = { ...DEFAULT_AZKAR_REMINDER_SETTINGS, enabled: true };

describe("nextAzkarReminderEvent", () => {
  it("fires sabah 15 min after Fajr", () => {
    const ev = nextAzkarReminderEvent(instants(), enabled, new Date(2026, 5, 7, 3, 0));
    expect(ev?.kind).toBe("sabah");
    expect(ev?.time).toEqual(new Date(2026, 5, 7, 4, 15));
  });

  it("fires masaa 15 min after Asr once sabah has passed", () => {
    const ev = nextAzkarReminderEvent(instants(), enabled, new Date(2026, 5, 7, 13, 0));
    expect(ev?.kind).toBe("masaa");
    expect(ev?.time).toEqual(new Date(2026, 5, 7, 15, 15));
  });

  it("honours a custom offset", () => {
    const settings = { ...enabled, offsetMinutes: 30 };
    const ev = nextAzkarReminderEvent(instants(), settings, new Date(2026, 5, 7, 3, 0));
    expect(ev?.time).toEqual(new Date(2026, 5, 7, 4, 30));
  });

  it("returns null when disabled", () => {
    expect(
      nextAzkarReminderEvent(instants(), DEFAULT_AZKAR_REMINDER_SETTINGS, new Date(2026, 5, 7, 3, 0)),
    ).toBeNull();
  });

  it("returns null when nothing remains today", () => {
    expect(nextAzkarReminderEvent(instants(), enabled, new Date(2026, 5, 7, 16, 0))).toBeNull();
  });
});

describe("recentlyMissedAzkarReminder", () => {
  const GRACE = 2 * 60_000; // 2 min

  it("recovers a sabah reminder that passed within the grace window", () => {
    // sabah = Fajr(4:00) + 15 = 4:15; now 4:16 → within 2 min.
    const ev = recentlyMissedAzkarReminder(instants(), enabled, new Date(2026, 5, 7, 4, 16), GRACE);
    expect(ev?.kind).toBe("sabah");
    expect(ev?.time).toEqual(new Date(2026, 5, 7, 4, 15));
  });

  it("returns null when the reminder is older than the grace window", () => {
    const ev = recentlyMissedAzkarReminder(instants(), enabled, new Date(2026, 5, 7, 4, 20), GRACE);
    expect(ev).toBeNull();
  });

  it("returns null when disabled", () => {
    expect(
      recentlyMissedAzkarReminder(instants(), DEFAULT_AZKAR_REMINDER_SETTINGS, new Date(2026, 5, 7, 4, 16), GRACE),
    ).toBeNull();
  });

  it("does not return a future reminder", () => {
    expect(
      recentlyMissedAzkarReminder(instants(), enabled, new Date(2026, 5, 7, 4, 10), GRACE),
    ).toBeNull();
  });
});

describe("isAzkarReminderEventStale", () => {
  const GRACE = 2 * 60_000; // 2 min
  const ev = (h: number, m = 0) => ({
    kind: "sabah" as const,
    time: new Date(2026, 5, 7, h, m, 0, 0),
  });

  it("is stale when a morning timer resolves on wake hours late", () => {
    const now = new Date(2026, 5, 7, 19, 0, 0); // sabah 04:15 timer fires at 19:00
    expect(isAzkarReminderEventStale(ev(4, 15), now, GRACE)).toBe(true);
  });

  it("is not stale when fired within the grace window", () => {
    expect(isAzkarReminderEventStale(ev(4, 15), new Date(2026, 5, 7, 4, 16), GRACE)).toBe(false);
  });

  it("is not stale at exactly the grace boundary", () => {
    expect(isAzkarReminderEventStale(ev(4, 15), new Date(2026, 5, 7, 4, 17), GRACE)).toBe(false);
  });

  it("is not stale when the timer fires slightly early", () => {
    expect(isAzkarReminderEventStale(ev(4, 15), new Date(2026, 5, 7, 4, 14, 59), GRACE)).toBe(false);
  });
});
