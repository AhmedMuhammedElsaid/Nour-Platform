// Aladhan.com prayer-times API client + AsyncStorage month cache.
// https://aladhan.com/prayer-times-api#GetCalendar
//
// Strategy: fetch a full month at once (one request per month per location+method),
// cache it keyed by rounded coordinates so tiny GPS jitter doesn't bust the cache,
// fall back to local adhan-js computation if the network is unavailable.

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { CalculationMethodId, MadhabId } from "@repo/shared-core/schemas/prayer-times";
import {
  computePrayerTimes,
  type PrayerDay,
  type PrayerKey,
} from "@repo/shared-core/prayer-times/compute";

// App method IDs → Aladhan method numbers.
const METHOD_MAP: Record<CalculationMethodId, number> = {
  Egyptian: 5,
  MuslimWorldLeague: 3,
  Karachi: 1,
  UmmAlQura: 4,
  Dubai: 16,
  MoonsightingCommittee: 15,
  NorthAmerica: 2,
  Kuwait: 9,
  Qatar: 10,
  Singapore: 11,
  Turkey: 13,
  Tehran: 7,
};

// Aladhan school param: 0 = Shafi/Maliki/Hanbali (standard), 1 = Hanafi.
const SCHOOL_MAP: Record<MadhabId, 0 | 1> = { standard: 0, hanafi: 1 };

// --- Types ---

type AladhanTimings = {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
};

type AladhanEntry = {
  timings: AladhanTimings;
  date: {
    gregorian: {
      day: string;
      month: { number: number };
      year: string;
    };
  };
};

type AladhanResponse = { code: number; data: AladhanEntry[] };

// Serialised form stored in AsyncStorage (Date → ISO string).
type CachedEntry = { date: string; instants: { key: PrayerKey; time: string }[] };
type CachedMonth = { days: Record<string, CachedEntry> };

// --- Helpers ---

// "05:30 (EET)" or "05:30 (+02:00)" → { h, m }
function parseHM(raw: string): { h: number; m: number } {
  const hm = raw.split(" ")[0] ?? "0:0";
  const [hStr, mStr] = hm.split(":");
  return { h: parseInt(hStr ?? "0", 10), m: parseInt(mStr ?? "0", 10) };
}

// Local date key that avoids the UTC-date-shift issue with toISOString().
function localKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const PRAYER_FIELD_MAP: [PrayerKey, keyof AladhanTimings][] = [
  ["fajr", "Fajr"],
  ["sunrise", "Sunrise"],
  ["dhuhr", "Dhuhr"],
  ["asr", "Asr"],
  ["maghrib", "Maghrib"],
  ["isha", "Isha"],
];

function entryToPrayerDay(e: AladhanEntry): { key: string; day: PrayerDay } {
  const g = e.date.gregorian;
  const year = parseInt(g.year, 10);
  const month = g.month.number;
  const day = parseInt(g.day, 10);
  const date = new Date(year, month - 1, day);
  return {
    key: localKey(year, month, day),
    day: {
      date,
      instants: PRAYER_FIELD_MAP.map(([pkey, field]) => {
        const { h, m } = parseHM(e.timings[field]);
        return { key: pkey, time: new Date(year, month - 1, day, h, m, 0, 0) };
      }),
    },
  };
}

function storageKey(
  lat: number,
  lng: number,
  method: CalculationMethodId,
  madhab: MadhabId,
  year: number,
  month: number,
): string {
  // Round to 2 dp (~1 km) so minor GPS jitter doesn't miss the cache.
  return `nour.prayer.calendar.${lat.toFixed(2)}-${lng.toFixed(2)}-${method}-${madhab}-${year}-${month}`;
}

// --- Fetch + cache ---

async function fetchMonth(
  lat: number,
  lng: number,
  method: CalculationMethodId,
  madhab: MadhabId,
  year: number,
  month: number,
): Promise<Record<string, PrayerDay>> {
  const url =
    `https://api.aladhan.com/v1/calendar/${year}/${month}` +
    `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&method=${METHOD_MAP[method]}&school=${SCHOOL_MAP[madhab]}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new Error(`Aladhan HTTP ${res.status}`);
  const json = (await res.json()) as AladhanResponse;
  if (json.code !== 200) throw new Error(`Aladhan code ${json.code}`);

  const days: Record<string, PrayerDay> = {};
  for (const entry of json.data) {
    const { key, day } = entryToPrayerDay(entry);
    days[key] = day;
  }
  return days;
}

async function loadCached(
  key: string,
): Promise<Record<string, PrayerDay> | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as CachedMonth;
  const days: Record<string, PrayerDay> = {};
  for (const [dk, v] of Object.entries(parsed.days)) {
    days[dk] = {
      date: new Date(v.date),
      instants: v.instants.map((i) => ({ key: i.key, time: new Date(i.time) })),
    };
  }
  return days;
}

async function persistMonth(
  key: string,
  days: Record<string, PrayerDay>,
): Promise<void> {
  const toStore: CachedMonth = { days: {} };
  for (const [dk, d] of Object.entries(days)) {
    toStore.days[dk] = {
      date: d.date.toISOString(),
      instants: d.instants.map((i) => ({
        key: i.key,
        time: (i.time ?? new Date(0)).toISOString(),
      })),
    };
  }
  await AsyncStorage.setItem(key, JSON.stringify(toStore));
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
  const key = storageKey(lat, lng, method, madhab, year, month);

  try {
    // Try cache first.
    const cached = await loadCached(key);
    if (cached?.[dk]) return cached[dk]!;

    // Cache miss — fetch the month.
    const days = await fetchMonth(lat, lng, method, madhab, year, month);
    await persistMonth(key, days).catch(() => {});
    if (days[dk]) return days[dk]!;
  } catch {
    // Network error or parse failure — fall through to local computation.
  }

  return computePrayerTimes({ lat, lng, date, method, madhab });
}
