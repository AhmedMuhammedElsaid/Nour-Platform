import { describe, expect, it } from "vitest";

import {
  DEFAULT_ADHAN_SETTINGS,
  DEFAULT_AZKAR_REMINDER_SETTINGS,
} from "../schemas/prayer-times";
import type { PrayerInstant } from "./compute";
import {
  isAdhanEventStale,
  isAzkarReminderEventStale,
  nextAdhanEvent,
  nextAzkarReminderEvent,
  recentlyMissedAdhan,
  recentlyMissedAzkarReminder,
} from "./schedule";

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

// ── nextAdhanEvent ────────────────────────────────────────────────────────────

describe("nextAdhanEvent", () => {
  it("returns the soonest enabled prayer strictly after now", () => {
    const now = new Date(2026, 5, 7, 13, 0, 0);
    const ev = nextAdhanEvent(instants(), DEFAULT_ADHAN_SETTINGS, now);
    expect(ev?.key).toBe("asr");
  });

  it("never returns sunrise", () => {
    const now = new Date(2026, 5, 7, 5, 0, 0);
    const ev = nextAdhanEvent(instants(), DEFAULT_ADHAN_SETTINGS, now);
    expect(ev?.key).toBe("dhuhr");
  });

  it("skips a disabled prayer", () => {
    const now = new Date(2026, 5, 7, 13, 0, 0);
    const settings = {
      ...DEFAULT_ADHAN_SETTINGS,
      perPrayer: { ...DEFAULT_ADHAN_SETTINGS.perPrayer, asr: false },
    };
    const ev = nextAdhanEvent(instants(), settings, now);
    expect(ev?.key).toBe("maghrib");
  });

  it("returns null when no enabled prayer remains today", () => {
    const now = new Date(2026, 5, 7, 21, 0, 0);
    expect(nextAdhanEvent(instants(), DEFAULT_ADHAN_SETTINGS, now)).toBeNull();
  });

  it("returns null when all prayers disabled", () => {
    const now = new Date(2026, 5, 7, 3, 0, 0);
    const settings = {
      ...DEFAULT_ADHAN_SETTINGS,
      perPrayer: { fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false },
    };
    expect(nextAdhanEvent(instants(), settings, now)).toBeNull();
  });
});

// ── recentlyMissedAdhan ───────────────────────────────────────────────────────

describe("recentlyMissedAdhan", () => {
  const GRACE = 2 * 60_000;

  it("returns an adhan that passed within the grace window", () => {
    const now = new Date(2026, 5, 7, 12, 1, 0);
    const ev = recentlyMissedAdhan(instants(), DEFAULT_ADHAN_SETTINGS, now, GRACE);
    expect(ev?.key).toBe("dhuhr");
  });

  it("returns null when the last adhan is older than the grace window", () => {
    const now = new Date(2026, 5, 7, 12, 5, 0);
    expect(recentlyMissedAdhan(instants(), DEFAULT_ADHAN_SETTINGS, now, GRACE)).toBeNull();
  });

  it("ignores a disabled prayer even if recently passed", () => {
    const now = new Date(2026, 5, 7, 12, 1, 0);
    const settings = {
      ...DEFAULT_ADHAN_SETTINGS,
      perPrayer: { ...DEFAULT_ADHAN_SETTINGS.perPrayer, dhuhr: false },
    };
    expect(recentlyMissedAdhan(instants(), settings, now, GRACE)).toBeNull();
  });

  it("never returns sunrise", () => {
    const now = new Date(2026, 5, 7, 6, 1, 0);
    expect(recentlyMissedAdhan(instants(), DEFAULT_ADHAN_SETTINGS, now, GRACE)).toBeNull();
  });

  it("does not return a future adhan", () => {
    const now = new Date(2026, 5, 7, 11, 59, 0);
    expect(recentlyMissedAdhan(instants(), DEFAULT_ADHAN_SETTINGS, now, GRACE)).toBeNull();
  });
});

// ── isAdhanEventStale ─────────────────────────────────────────────────────────

describe("isAdhanEventStale", () => {
  const GRACE = 2 * 60_000;
  const ev = (h: number, m = 0) => ({
    key: "fajr" as const,
    time: new Date(2026, 5, 7, h, m, 0, 0),
  });

  it("is stale when a pre-Fajr timer resolves on wake at Maghrib", () => {
    const now = new Date(2026, 5, 7, 19, 0, 0);
    expect(isAdhanEventStale(ev(4), now, GRACE)).toBe(true);
  });

  it("is not stale when fired within the grace window", () => {
    const now = new Date(2026, 5, 7, 4, 1, 0);
    expect(isAdhanEventStale(ev(4), now, GRACE)).toBe(false);
  });

  it("is not stale at exactly the grace boundary", () => {
    const now = new Date(2026, 5, 7, 4, 2, 0);
    expect(isAdhanEventStale(ev(4), now, GRACE)).toBe(false);
  });

  it("is not stale when the timer fires slightly early", () => {
    const now = new Date(2026, 5, 7, 3, 59, 59);
    expect(isAdhanEventStale(ev(4), now, GRACE)).toBe(false);
  });
});

// ── nextAzkarReminderEvent ────────────────────────────────────────────────────

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

// ── recentlyMissedAzkarReminder ───────────────────────────────────────────────

describe("recentlyMissedAzkarReminder", () => {
  const GRACE = 2 * 60_000;

  it("recovers a sabah reminder that passed within the grace window", () => {
    const ev = recentlyMissedAzkarReminder(instants(), enabled, new Date(2026, 5, 7, 4, 16), GRACE);
    expect(ev?.kind).toBe("sabah");
    expect(ev?.time).toEqual(new Date(2026, 5, 7, 4, 15));
  });

  it("returns null when the reminder is older than the grace window", () => {
    expect(recentlyMissedAzkarReminder(instants(), enabled, new Date(2026, 5, 7, 4, 20), GRACE)).toBeNull();
  });

  it("returns null when disabled", () => {
    expect(
      recentlyMissedAzkarReminder(instants(), DEFAULT_AZKAR_REMINDER_SETTINGS, new Date(2026, 5, 7, 4, 16), GRACE),
    ).toBeNull();
  });

  it("does not return a future reminder", () => {
    expect(recentlyMissedAzkarReminder(instants(), enabled, new Date(2026, 5, 7, 4, 10), GRACE)).toBeNull();
  });
});

// ── isAzkarReminderEventStale ─────────────────────────────────────────────────

describe("isAzkarReminderEventStale", () => {
  const GRACE = 2 * 60_000;
  const ev = (h: number, m = 0) => ({
    kind: "sabah" as const,
    time: new Date(2026, 5, 7, h, m, 0, 0),
  });

  it("is stale when a morning timer resolves on wake hours late", () => {
    expect(isAzkarReminderEventStale(ev(4, 15), new Date(2026, 5, 7, 19, 0, 0), GRACE)).toBe(true);
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
