import { describe, expect, it } from "vitest";

import { DEFAULT_AZKAR_REMINDER_SETTINGS } from "@repo/api/schemas/prayer-times";
import type { PrayerInstant } from "@repo/api/services/prayer-times";

import { nextAzkarReminderEvent } from "./azkar-reminder-schedule";

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
