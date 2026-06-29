// Aladhan.com prayer-times client + localStorage month cache (web port of the
// mobile apps/mobile/features/prayer-times/lib/aladhan.ts). adhan-js local
// computation can land ±1 min from official Egyptian-Ministry times due to
// floating point; the Aladhan calendar API returns the authoritative minute.
// Both apps now source adhan firing from Aladhan with an adhan-js fallback.
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
  type PrayerKey,
} from "@repo/api/services/prayer-times";
import type {
  CalculationMethodId,
  MadhabId,
} from "@repo/api/schemas/prayer-times";

// App method IDs → Aladhan method numbers (mirrors the mobile client).
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
  date: { gregorian: { day: string; month: { number: number }; year: string } };
};

type AladhanResponse = { code: number; data: AladhanEntry[] };

// Serialised cache form (Date → ISO string).
type CachedEntry = { date: string; instants: { key: PrayerKey; time: string }[] };
type CachedMonth = { days: Record<string, CachedEntry> };

const PRAYER_FIELD_MAP: [PrayerKey, keyof AladhanTimings][] = [
  ["fajr", "Fajr"],
  ["sunrise", "Sunrise"],
  ["dhuhr", "Dhuhr"],
  ["asr", "Asr"],
  ["maghrib", "Maghrib"],
  ["isha", "Isha"],
];

// "05:30 (EET)" / "05:30 (+02:00)" → { h, m }
function parseHM(raw: string): { h: number; m: number } {
  const hm = raw.split(" ")[0] ?? "0:0";
  const [hStr, mStr] = hm.split(":");
  return { h: parseInt(hStr ?? "0", 10), m: parseInt(mStr ?? "0", 10) };
}

// Local date key, avoiding the UTC-shift of toISOString().
function localKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function entryToPrayerDay(e: AladhanEntry): { key: string; day: PrayerDay } {
  const g = e.date.gregorian;
  const year = parseInt(g.year, 10);
  const month = g.month.number;
  const day = parseInt(g.day, 10);
  return {
    key: localKey(year, month, day),
    day: {
      date: new Date(year, month - 1, day),
      instants: PRAYER_FIELD_MAP.map(([pkey, field]) => {
        const { h, m } = parseHM(e.timings[field]);
        const d = new Date(year, month - 1, day, h, m, 0, 0);
        // Null out a malformed timing rather than emit an Invalid Date — a NaN
        // time would otherwise show "Invalid Date" in the UI and (before the
        // scheduler's finite guards) mis-fire the adhan. Mirrors computePrayerTimes.
        return { key: pkey, time: Number.isFinite(d.getTime()) ? d : null };
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

function loadCachedMonth(key: string): Record<string, PrayerDay> | null {
  try {
    const raw = localStorage.getItem(key);
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
  } catch {
    return null;
  }
}

function persistMonth(key: string, days: Record<string, PrayerDay>): void {
  try {
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
    localStorage.setItem(key, JSON.stringify(toStore));
  } catch {
    /* storage unavailable — official times just won't persist */
  }
}

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
  const dk = localKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const key = storageKey(lat, lng, method, madhab, date.getFullYear(), date.getMonth() + 1);
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
  const key = storageKey(lat, lng, method, madhab, year, month);
  if (loadCachedMonth(key) != null) return; // already warm
  try {
    const days = await fetchMonth(lat, lng, method, madhab, year, month);
    persistMonth(key, days);
  } catch {
    /* offline / API error — fallback to computePrayerTimes via resolvePrayerDay */
  }
}
