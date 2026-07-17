// Aladhan.com prayer-times client + localStorage month cache. This module is
// now a thin sync-localStorage glue layer — the actual API client, timing
// parser, and cache (de)serializer live in the pure, cross-platform
// `@repo/shared-core/prayer-times/aladhan` (shared with mobile's AsyncStorage
// glue and the extension's browser.storage glue). adhan-js local computation
// can land ±1 min from official Egyptian-Ministry times due to floating
// point; the Aladhan calendar API returns the authoritative minute. All
// surfaces now source adhan firing from Aladhan with an adhan-js fallback.
//
// Integration note: the web adhan scheduler is synchronous and self-correcting
// (re-arms from the live clock every few minutes). To keep that, this module
// exposes a SYNC `resolvePrayerDay` that returns cached Aladhan times when the
// month is warm and otherwise falls back to `computePrayerTimes`, plus an async
// `ensurePrayerMonth` the controller calls to warm the cache. So the first few
// minutes after enabling use adhan-js, then upgrade to official times silently.

import {
  computePrayerTimes,
  type PrayerDay,
} from "@repo/api/services/prayer-times";
import type {
  CalculationMethodId,
  MadhabId,
} from "@repo/api/schemas/prayer-times";
import {
  aladhanStorageKey,
  deserializeMonth,
  fetchAladhanMonth,
  localKeyForDate,
  serializeMonth,
} from "@repo/shared-core/prayer-times/aladhan";

function loadCachedMonth(key: string): Record<string, PrayerDay> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? null : deserializeMonth(raw);
  } catch {
    return null;
  }
}

function persistMonth(key: string, days: Record<string, PrayerDay>): void {
  try {
    localStorage.setItem(key, serializeMonth(days));
  } catch {
    /* storage unavailable — official times just won't persist */
  }
}

// --- Public API ---

type PrayerDayParams = {
  lat: number;
  lng: number;
  method: CalculationMethodId;
  madhab: MadhabId;
  date: Date;
};

// Sync: the official Aladhan PrayerDay for `date` if its month is cached, else
// null. Safe on the server / before hydration (returns null without throwing).
export function cachedPrayerDay(params: PrayerDayParams): PrayerDay | null {
  if (typeof window === "undefined") return null;
  const { lat, lng, method, madhab, date } = params;
  const dk = localKeyForDate(date);
  const key = aladhanStorageKey(lat, lng, method, madhab, date.getFullYear(), date.getMonth() + 1);
  return loadCachedMonth(key)?.[dk] ?? null;
}

// Sync drop-in for computePrayerTimes: official times when the month is cached,
// otherwise the adhan-js computation (which the controller's prefetch upgrades).
export function resolvePrayerDay(params: PrayerDayParams): PrayerDay {
  return cachedPrayerDay(params) ?? computePrayerTimes(params);
}

// Async: ensure `date`'s month is fetched + cached (one request per month per
// location/method). Idempotent and best-effort — network/parse errors are
// swallowed so the adhan-js fallback keeps the scheduler working offline.
export async function ensurePrayerMonth(params: PrayerDayParams): Promise<void> {
  if (typeof window === "undefined") return;
  const { lat, lng, method, madhab, date } = params;
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const key = aladhanStorageKey(lat, lng, method, madhab, year, month);
  if (loadCachedMonth(key) != null) return; // already warm
  try {
    const days = await fetchAladhanMonth(lat, lng, method, madhab, year, month);
    persistMonth(key, days);
  } catch {
    /* offline / API error — fallback to computePrayerTimes via resolvePrayerDay */
  }
}
