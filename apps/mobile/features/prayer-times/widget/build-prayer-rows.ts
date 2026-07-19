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
  getArcPosition,
  getNextPrayer,
  type PrayerDay,
  type PrayerKey,
} from "@repo/shared-core/prayer-times/compute";
import {
  type CalculationMethodId,
  type MadhabId,
  type PrayerLocation,
} from "@repo/shared-core/schemas/prayer-times";
import { formatClock, formatRemainingHM } from "@repo/shared-core/prayer-times/format";

import { cityLabel } from "@/features/prayer-times/data/cities";
import { buildArcDots, type ArcDot } from "@/features/prayer-times/lib/arc-dots";

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

const NEXT_PRAYER_TITLE: Record<"ar" | "en", string> = {
  ar: "الصلاة القادمة",
  en: "Next prayer",
};

export type PrayerRow = {
  key: PrayerKey;
  label: string;
  time: string;
  isNext: boolean;
};

// Active-body position for the widget's sun/moon arc (build-arc-svg.ts). Same
// shape getArcPosition returns in-app (SunArc props) — see
// prayer-times-widget.tsx:98-105 for the mirrored call pattern.
export type PrayerArc = {
  fraction: number;
  isNight: boolean;
  onNightBand: boolean;
};

// Static (non-ticking — the widget bitmap can't animate) "time remaining"
// readout, shown between the arc and the prayer row. Hours:minutes only, via
// formatRemainingHM — never the live seconds-ticking formatCountdownClock the
// in-app PrayerCountdown leaf uses. null only in the degenerate case where
// neither today's remaining prayers nor a rolled-over tomorrow resolve (e.g.
// high-latitude no-Fajr edge in rollToTomorrow) — the widget simply omits the
// block that refresh.
export type NextPrayerInfo = {
  title: string; // "Next prayer" / "الصلاة القادمة"
  name: string; // localized prayer name, e.g. "Fajr" / "الفجر"
  remaining: string; // "H:MM", localized digits
};

export type PrayerRowsResult = {
  city: string;
  rows: PrayerRow[];
  next: NextPrayerInfo | null;
  arc: PrayerArc;
  dots: ArcDot[];
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

  // Arc position + dots for the widget's sun/moon arc SVG (build-arc-svg.ts).
  // Deliberately local adhan-js throughout (matches this builder's existing
  // choice, see file header) — resolveDay just recomputes for any date
  // getArcPosition asks for (tomorrow's Fajr after Isha, yesterday's Isha
  // pre-Fajr), no Aladhan-day special-casing needed since everything here is
  // already local.
  const arc = getArcPosition((date) => computePrayerTimes({ ...input, date }), now);
  const dots = buildArcDots(day, nextKey);

  const nextInst = nextKey ? (day.instants.find((i) => i.key === nextKey)?.time ?? null) : null;
  const nextInfo: NextPrayerInfo | null =
    nextKey && nextInst
      ? {
          title: NEXT_PRAYER_TITLE[locale],
          name: PRAYER_LABELS[nextKey][locale],
          remaining: formatRemainingHM(nextInst.getTime() - now.getTime(), locale),
        }
      : null;

  return { city: cityLabel(location, locale), rows, next: nextInfo, arc, dots };
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
