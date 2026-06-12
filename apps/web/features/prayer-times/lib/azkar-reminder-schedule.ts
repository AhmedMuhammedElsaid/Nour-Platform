import type { AzkarReminderSettings } from "@repo/api/schemas/prayer-times";
import type { PrayerInstant } from "@repo/api/services/prayer-times";

export type AzkarReminderKind = "sabah" | "masaa";
export type AzkarReminderEvent = { kind: AzkarReminderKind; time: Date };

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
// at `now` — i.e. its timer resolved long after it was armed. Browser timers
// are paused while the device sleeps and resume on wake, so the final-window
// setTimeout (which captures a specific event) can fire hours late. Mirrors the
// adhan scheduler's freshness guard so a reminder only ever shows within
// `graceMs` of its time. Pure — no DOM/Date.now.
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
