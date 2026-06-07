import {
  ADHAN_PRAYER_KEYS,
  type AdhanPrayerKey,
  type AdhanSettings,
} from "@repo/api/schemas/prayer-times";
import type { PrayerInstant } from "@repo/api/services/prayer-times";

export type AdhanEvent = { key: AdhanPrayerKey; time: Date };

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
