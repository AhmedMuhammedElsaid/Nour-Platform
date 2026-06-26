import {
  ADHAN_PRAYER_KEYS,
  type AdhanPrayerKey,
  type AdhanSettings,
  type AzkarReminderSettings,
} from "../schemas/prayer-times";
import type { PrayerInstant } from "./compute";

export type AdhanEvent = { key: AdhanPrayerKey; time: Date };
export type AzkarReminderKind = "sabah" | "masaa";
export type AzkarReminderEvent = { kind: AzkarReminderKind; time: Date };

const ADHAN_KEY_SET = new Set<string>(ADHAN_PRAYER_KEYS);

function isAdhanKey(key: string): key is AdhanPrayerKey {
  return ADHAN_KEY_SET.has(key);
}

// Soonest *enabled* adhan prayer strictly after `now` within the given day.
// Sunrise is excluded (not in ADHAN_PRAYER_KEYS). Returns null if none remain
// or all are disabled. Pure — no DOM, no Date.now().
export function nextAdhanEvent(
  instants: PrayerInstant[],
  settings: AdhanSettings,
  now: Date,
): AdhanEvent | null {
  let best: AdhanEvent | null = null;
  for (const instant of instants) {
    const { key, time } = instant;
    if (time == null || !isAdhanKey(key)) continue;
    if (!settings.perPrayer[key]) continue;
    if (time.getTime() <= now.getTime()) continue;
    if (best == null || time.getTime() < best.time.getTime()) {
      best = { key, time };
    }
  }
  return best;
}

// True when an event's scheduled instant is more than `graceMs` in the past at
// `now` — i.e. its timer resolved long after it was armed. Browser timers are
// *paused* while the device sleeps and resume on wake, so the final-window
// setTimeout (which captures a specific event) can fire its event hours late:
// a precise timer armed just before Fajr that resolves on wake at Maghrib would
// otherwise play the Fajr adhan. Such fires must be dropped — the re-arm then
// picks the correct upcoming prayer from the live clock. Mirrors the
// `recentlyMissedAdhan` grace so an adhan only ever plays within `graceMs` of
// its time. A timer that fires slightly early (now < time) is never stale.
// Pure — no DOM, no Date.now().
export function isAdhanEventStale(
  event: AdhanEvent,
  now: Date,
  graceMs: number,
): boolean {
  return now.getTime() - event.time.getTime() > graceMs;
}

// Most-recent *enabled* adhan whose time falls within the last `graceMs`, i.e.
// in the half-open window (now - graceMs, now]. Used to catch up an adhan that
// the foreground timer missed because the tab was backgrounded/throttled or the
// device was asleep across the prayer time. Pure — no DOM, no Date.now().
export function recentlyMissedAdhan(
  instants: PrayerInstant[],
  settings: AdhanSettings,
  now: Date,
  graceMs: number,
): AdhanEvent | null {
  const lo = now.getTime() - graceMs;
  let best: AdhanEvent | null = null;
  for (const instant of instants) {
    const { key, time } = instant;
    if (time == null || !isAdhanKey(key)) continue;
    if (!settings.perPrayer[key]) continue;
    const tt = time.getTime();
    if (tt > now.getTime() || tt <= lo) continue;
    if (best == null || tt > best.time.getTime()) {
      best = { key, time };
    }
  }
  return best;
}

// Azkar al-Sabah trails Fajr; al-Masaa trails Asr — both by `offsetMinutes`.
const BASE_PRAYER: Record<AzkarReminderKind, string> = {
  sabah: "fajr",
  masaa: "asr",
};

// Soonest enabled azkar reminder strictly after `now` within the given day.
// Returns null when disabled or nothing remains today. Pure — no DOM/Date.now.
export function nextAzkarReminderEvent(
  instants: PrayerInstant[],
  settings: AzkarReminderSettings,
  now: Date,
): AzkarReminderEvent | null {
  if (!settings.enabled) return null;
  const offsetMs = settings.offsetMinutes * 60_000;

  let best: AzkarReminderEvent | null = null;
  for (const kind of ["sabah", "masaa"] as const) {
    const base = instants.find((i) => i.key === BASE_PRAYER[kind]);
    if (!base?.time) continue;
    const time = new Date(base.time.getTime() + offsetMs);
    if (time.getTime() <= now.getTime()) continue;
    if (best == null || time.getTime() < best.time.getTime()) {
      best = { kind, time };
    }
  }
  return best;
}

// True when a reminder's scheduled instant is more than `graceMs` in the past
// at `now` — i.e. its timer resolved long after it was armed. Mirrors the
// adhan scheduler's freshness guard. Pure — no DOM/Date.now.
export function isAzkarReminderEventStale(
  event: AzkarReminderEvent,
  now: Date,
  graceMs: number,
): boolean {
  return now.getTime() - event.time.getTime() > graceMs;
}

// Most-recent enabled azkar reminder within the last `graceMs` — window
// (now - graceMs, now]. Catches up a reminder the foreground timer missed
// while the tab was backgrounded/asleep. Pure — no DOM/Date.now.
export function recentlyMissedAzkarReminder(
  instants: PrayerInstant[],
  settings: AzkarReminderSettings,
  now: Date,
  graceMs: number,
): AzkarReminderEvent | null {
  if (!settings.enabled) return null;
  const offsetMs = settings.offsetMinutes * 60_000;
  const lo = now.getTime() - graceMs;

  let best: AzkarReminderEvent | null = null;
  for (const kind of ["sabah", "masaa"] as const) {
    const base = instants.find((i) => i.key === BASE_PRAYER[kind]);
    if (!base?.time) continue;
    const tt = base.time.getTime() + offsetMs;
    if (tt > now.getTime() || tt <= lo) continue;
    if (best == null || tt > best.time.getTime()) {
      best = { kind, time: new Date(tt) };
    }
  }
  return best;
}
