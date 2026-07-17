// Aladhan.com prayer-times API client + AsyncStorage month cache.
// https://aladhan.com/prayer-times-api#GetCalendar
//
// This module is now a thin AsyncStorage glue layer — the actual API client,
// timing parser, and cache (de)serializer live in the pure, cross-platform
// `@repo/shared-core/prayer-times/aladhan` (shared with web's localStorage
// glue and the extension's browser.storage glue).
//
// Strategy: fetch a full month at once (one request per month per location+method),
// cache it keyed by rounded coordinates so tiny GPS jitter doesn't bust the cache,
// fall back to local adhan-js computation if the network is unavailable.

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { CalculationMethodId, MadhabId } from "@repo/shared-core/schemas/prayer-times";
import {
  computePrayerTimes,
  type PrayerDay,
} from "@repo/shared-core/prayer-times/compute";
import {
  aladhanStorageKey,
  deserializeMonth,
  fetchAladhanMonth,
  localKey,
  serializeMonth,
} from "@repo/shared-core/prayer-times/aladhan";

async function loadCached(
  key: string,
): Promise<Record<string, PrayerDay> | null> {
  const raw = await AsyncStorage.getItem(key);
  return raw == null ? null : deserializeMonth(raw);
}

// --- Public API ---

// Returns the PrayerDay for `date` sourced from Aladhan's pre-computed calendar
// (cached per-month per-location). Falls back to local adhan-js computation if
// the device is offline or the API call fails.
export async function getPrayerDay(
  lat: number,
  lng: number,
  method: CalculationMethodId,
  madhab: MadhabId,
  date: Date,
): Promise<PrayerDay> {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const dk = localKey(year, month, date.getDate());
  const key = aladhanStorageKey(lat, lng, method, madhab, year, month);

  try {
    // Try cache first.
    const cached = await loadCached(key);
    if (cached?.[dk]) return cached[dk]!;

    // Cache miss — fetch the month.
    const days = await fetchAladhanMonth(lat, lng, method, madhab, year, month);
    await AsyncStorage.setItem(key, serializeMonth(days)).catch(() => {});
    if (days[dk]) return days[dk]!;
  } catch {
    // Network error or parse failure — fall through to local computation.
  }

  return computePrayerTimes({ lat, lng, date, method, madhab });
}
