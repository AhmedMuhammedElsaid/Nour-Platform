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
