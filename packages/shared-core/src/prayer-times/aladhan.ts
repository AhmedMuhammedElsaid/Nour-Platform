// Aladhan.com prayer-times API — pure, platform-free core shared by all three
// surfaces. Web (localStorage), mobile (AsyncStorage), and the extension
// (browser.storage) each keep a thin glue module; nothing here touches storage.
//
// Times are requested with `iso8601=true`, so every timing carries the CITY's
// UTC offset for that specific date ("2026-10-30T04:40:00+02:00" — Aladhan
// encodes the DST switch per day). Parsing them as absolute instants makes the
// result independent of the device's timezone AND of the device's tz database
// agreeing with the official source about a DST switch date (Egypt announces
// these on short notice). The legacy "HH:MM (EET)" form remains as a
// device-local fallback in case the API ever ignores the param — that path is
// only correct when the device sits in the selected city's timezone, which is
// exactly the pre-fix behaviour.

import type { CalculationMethodId, MadhabId } from "../schemas/prayer-times";
import type { PrayerDay, PrayerKey } from "./compute";

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

// Serialised cache form (Date → ISO string; a malformed timing stays null so
// deserialisation can't resurrect it as a "valid" epoch-0 date).
type CachedEntry = {
  date: string;
  instants: { key: PrayerKey; time: string | null }[];
};
type CachedMonth = { days: Record<string, CachedEntry> };

const PRAYER_FIELD_MAP: [PrayerKey, keyof AladhanTimings][] = [
  ["fajr", "Fajr"],
  ["sunrise", "Sunrise"],
  ["dhuhr", "Dhuhr"],
  ["asr", "Asr"],
  ["maghrib", "Maghrib"],
  ["isha", "Isha"],
];

// One instant from an Aladhan timing string, or null if malformed. ISO-first:
// "2026-10-30T04:40:00+02:00" is an absolute instant carrying the city's
// offset for that date. Fallback "05:30 (EET)" is interpreted device-locally.
export function parseTiming(
  raw: string,
  year: number,
  month: number,
  day: number,
): Date | null {
  // NOTE: match the full ISO date prefix, not just a "T" — the legacy form's
  // zone abbreviation can itself contain one ("05:30 (EET)").
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const d = new Date(raw);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const hm = raw.split(" ")[0] ?? "";
  const [hStr, mStr] = hm.split(":");
  const d = new Date(
    year,
    month - 1,
    day,
    parseInt(hStr ?? "", 10),
    parseInt(mStr ?? "", 10),
    0,
    0,
  );
  return Number.isFinite(d.getTime()) ? d : null;
}

// Local date key, avoiding the UTC-shift of toISOString().
export function localKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function localKeyForDate(date: Date): string {
  return localKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
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
      instants: PRAYER_FIELD_MAP.map(([pkey, field]) => ({
        key: pkey,
        time: parseTiming(e.timings[field], year, month, day),
      })),
    },
  };
}

// v2: v1 entries were parsed device-locally (no iso8601) — a version bump
// orphans them instead of letting a stale month mask the offset fix.
export function aladhanStorageKey(
  lat: number,
  lng: number,
  method: CalculationMethodId,
  madhab: MadhabId,
  year: number,
  month: number,
): string {
  // Round to 2 dp (~1 km) so minor GPS jitter doesn't miss the cache.
  return `nour.prayer.calendar.v2.${lat.toFixed(2)}-${lng.toFixed(2)}-${method}-${madhab}-${year}-${month}`;
}

export function serializeMonth(days: Record<string, PrayerDay>): string {
  const toStore: CachedMonth = { days: {} };
  for (const [dk, d] of Object.entries(days)) {
    toStore.days[dk] = {
      date: d.date.toISOString(),
      instants: d.instants.map((i) => ({
        key: i.key,
        time: i.time == null ? null : i.time.toISOString(),
      })),
    };
  }
  return JSON.stringify(toStore);
}

export function deserializeMonth(
  raw: string,
): Record<string, PrayerDay> | null {
  try {
    const parsed = JSON.parse(raw) as CachedMonth;
    const days: Record<string, PrayerDay> = {};
    for (const [dk, v] of Object.entries(parsed.days)) {
      days[dk] = {
        date: new Date(v.date),
        instants: v.instants.map((i) => ({
          key: i.key,
          time: i.time == null ? null : new Date(i.time),
        })),
      };
    }
    return days;
  } catch {
    return null;
  }
}

export async function fetchAladhanMonth(
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
    `&method=${METHOD_MAP[method]}&school=${SCHOOL_MAP[madhab]}&iso8601=true`;

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
