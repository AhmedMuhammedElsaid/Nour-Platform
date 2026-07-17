// Aladhan official-times glue for the extension — a browser.storage.local
// month cache over the pure client in @repo/shared-core/prayer-times/aladhan
// (web keeps the same cache in localStorage, mobile in AsyncStorage).
//
// adhan-js local computation can land ±1 min from official Egyptian-Ministry
// times; Aladhan returns the authoritative minute. The scheduler, the arc, and
// the timetable must all resolve through the SAME month map — a second time
// source re-introduces the moon-stuck-before-Fajr class of bug.
//
// browser.storage is async-only while `getArcPosition` needs a SYNC resolver,
// so the API is split: `loadPrayerMonth`/`warmPrayerMonth` are async and hand
// back a month map; `resolveDayFrom(month, params)` resolves synchronously
// against it, falling back to adhan-js while the cache is cold.
//
// The month cache keys are dynamic (`nour.prayer.calendar.v2.…`), so this
// module reads/writes browser.storage.local directly rather than going through
// the typed SCHEMA_MAP in storage.ts (same precedent as `setRaw`).

import browser from "webextension-polyfill";

import {
  computePrayerTimes,
  type PrayerDay,
} from "@repo/shared-core/prayer-times/compute";
import type {
  CalculationMethodId,
  MadhabId,
} from "@repo/shared-core/schemas/prayer-times";
import {
  aladhanStorageKey,
  deserializeMonth,
  fetchAladhanMonth,
  localKeyForDate,
  serializeMonth,
} from "@repo/shared-core/prayer-times/aladhan";

export type PrayerDayParams = {
  lat: number;
  lng: number;
  method: CalculationMethodId;
  madhab: MadhabId;
  date: Date;
};

export type PrayerMonth = Record<string, PrayerDay>;

// One fetch attempt per key per window: the 1-minute tick calls the warm path,
// and without a gate an offline machine would hit the API every minute. A key
// change (new month / new city / new method) bypasses the gate immediately.
const LAST_ATTEMPT_KEY = "nour.prayer.calendar.lastAttempt";
export const WARM_BACKOFF_MS = 6 * 60 * 60 * 1000;

function monthKey(params: PrayerDayParams): string {
  const { lat, lng, method, madhab, date } = params;
  return aladhanStorageKey(
    lat,
    lng,
    method,
    madhab,
    date.getFullYear(),
    date.getMonth() + 1,
  );
}

// The cached Aladhan month for `params.date`, or null when cold/corrupt.
export async function loadPrayerMonth(
  params: PrayerDayParams,
): Promise<PrayerMonth | null> {
  try {
    const key = monthKey(params);
    const result = await browser.storage.local.get(key);
    const raw: unknown = result[key];
    return typeof raw === "string" ? deserializeMonth(raw) : null;
  } catch {
    return null;
  }
}

// Sync resolution against a pre-loaded month map. Cold cache (or a date outside
// the loaded month, e.g. the night band straddling a month boundary) falls back
// to the adhan-js computation — sub-minute difference, self-corrects on warm.
export function resolveDayFrom(
  month: PrayerMonth | null,
  params: PrayerDayParams,
): PrayerDay {
  return month?.[localKeyForDate(params.date)] ?? computePrayerTimes(params);
}

// Fetch + persist the month for `params.date` if cold. Returns the month map
// (fresh or already-cached) or null when the fetch failed/was backoff-gated.
// Best-effort: all errors are swallowed — resolveDayFrom keeps working offline.
export async function warmPrayerMonth(
  params: PrayerDayParams,
): Promise<PrayerMonth | null> {
  const cached = await loadPrayerMonth(params);
  if (cached != null) return cached;

  const key = monthKey(params);
  try {
    const res = await browser.storage.local.get(LAST_ATTEMPT_KEY);
    const stamp: unknown = res[LAST_ATTEMPT_KEY];
    const isStamp = (v: unknown): v is { key: string; at: number } =>
      typeof v === "object" && v != null && "key" in v && "at" in v;
    if (
      isStamp(stamp) &&
      stamp.key === key &&
      Date.now() - stamp.at < WARM_BACKOFF_MS
    ) {
      return null;
    }
    await browser.storage.local.set({
      [LAST_ATTEMPT_KEY]: { key, at: Date.now() },
    });

    const days = await fetchAladhanMonth(
      params.lat,
      params.lng,
      params.method,
      params.madhab,
      params.date.getFullYear(),
      params.date.getMonth() + 1,
    );
    await browser.storage.local.set({ [key]: serializeMonth(days) });
    return days;
  } catch {
    return null;
  }
}

// One-call form for the background scheduler: warm if needed, then resolve.
export async function resolvePrayerDay(
  params: PrayerDayParams,
): Promise<PrayerDay> {
  const month = await warmPrayerMonth(params);
  return resolveDayFrom(month, params);
}

// Lets the UI hook re-load when the background (or another page) fetched the
// month first. Returns unsubscribe fn; `storage.ts#watch` can't be used here
// because the month keys are dynamic, not SCHEMA_MAP members.
export function watchPrayerMonth(
  params: PrayerDayParams,
  callback: (month: PrayerMonth | null) => void,
): () => void {
  const key = monthKey(params);
  const listener = (
    changes: Record<string, browser.Storage.StorageChange>,
    areaName: string,
  ) => {
    if (areaName !== "local" || !(key in changes)) return;
    const raw: unknown = changes[key]?.newValue;
    callback(typeof raw === "string" ? deserializeMonth(raw) : null);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
