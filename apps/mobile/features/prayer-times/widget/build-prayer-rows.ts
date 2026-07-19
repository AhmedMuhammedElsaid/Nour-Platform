// Pure prayer-row builder for the OS home-screen widget (home_widget_plan.md
// §5.5). Reuses the SAME adhan-js compute path the rest of the app is built
// on (packages/shared-core/src/prayer-times/compute.ts) rather than the
// Aladhan-cached `usePrayerDay` hook — that hook is React-Query/async-cache
// shaped and pulls in network + AsyncStorage caching machinery this widget
// doesn't need; a local adhan-js computation is accurate to the same minute
// in the overwhelming majority of cases and keeps this builder pure/sync.
// Accepted trade-off (see ADR 0014 / plan §4): the widget's displayed times
// can in rare edge cases differ by ~1 minute from the in-app Aladhan-sourced
// screen.

import {
  computePrayerTimes,
  getNextPrayer,
  type PrayerDay,
  type PrayerKey,
} from "@repo/shared-core/prayer-times/compute";
import {
  type CalculationMethodId,
  type MadhabId,
  type PrayerLocation,
} from "@repo/shared-core/schemas/prayer-times";
import { formatClock } from "@repo/shared-core/prayer-times/format";

import { cityLabel } from "@/features/prayer-times/data/cities";

const DAY_MS = 24 * 60 * 60 * 1000;

// Sunrise (Shrouq) is shown for reference on the widget row but is never the
// "next prayer" highlight (mirrors the in-app widget / azan scheduler).
const ROW_KEYS: PrayerKey[] = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

const PRAYER_LABELS: Record<PrayerKey, { ar: string; en: string }> = {
  fajr: { ar: "الفجر", en: "Fajr" },
  sunrise: { ar: "الشروق", en: "Sunrise" },
  dhuhr: { ar: "الظهر", en: "Dhuhr" },
  asr: { ar: "العصر", en: "Asr" },
  maghrib: { ar: "المغرب", en: "Maghrib" },
  isha: { ar: "العشاء", en: "Isha" },
};

export type PrayerRow = {
  key: PrayerKey;
  label: string;
  time: string;
  isNext: boolean;
};

export type PrayerRowsResult = {
  city: string;
  rows: PrayerRow[];
};

export function buildPrayerRows(
  location: PrayerLocation,
  prefs: { method: CalculationMethodId; madhab: MadhabId },
  now: Date,
  locale: "ar" | "en",
): PrayerRowsResult {
  const input = { lat: location.lat, lng: location.lng, method: prefs.method, madhab: prefs.madhab };
  const today = computePrayerTimes({ ...input, date: now });

  // Once today's Isha has passed, getNextPrayer returns null (compute.ts:120).
  // Roll the WHOLE row set to tomorrow's schedule (not just the highlight) —
  // otherwise the highlighted "next prayer" row would display today's
  // already-elapsed Fajr time instead of tomorrow's.
  const next = getNextPrayer(today, now);
  const tomorrow = next ? null : rollToTomorrow(today, input, now);
  const day = tomorrow ?? today;
  const nextKey: PrayerKey | null = next ? next.key : tomorrow ? "fajr" : null;

  const rows: PrayerRow[] = ROW_KEYS.map((key) => {
    const inst = day.instants.find((i) => i.key === key)?.time ?? null;
    return {
      key,
      label: PRAYER_LABELS[key][locale],
      time: formatClock(inst, locale),
      isNext: key === nextKey,
    };
  });

  return { city: cityLabel(location, locale), rows };
}

// After Isha, returns tomorrow's computed day so the rolled Fajr highlight
// shows tomorrow's time, not today's already-elapsed one — or null if Isha
// hasn't passed yet, or tomorrow has no Fajr instant (degenerate
// high-latitude case), in which case the caller keeps today's row set.
function rollToTomorrow(
  today: PrayerDay,
  input: { lat: number; lng: number; method: CalculationMethodId; madhab: MadhabId },
  now: Date,
): PrayerDay | null {
  const isha = today.instants.find((i) => i.key === "isha")?.time ?? null;
  if (isha == null || now.getTime() < isha.getTime()) return null;
  const tomorrow = computePrayerTimes({ ...input, date: new Date(now.getTime() + DAY_MS) });
  return tomorrow.instants.find((i) => i.key === "fajr")?.time != null ? tomorrow : null;
}
