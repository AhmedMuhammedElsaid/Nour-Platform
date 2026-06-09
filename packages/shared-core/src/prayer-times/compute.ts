import {
  CalculationMethod,
  type CalculationParameters,
  Coordinates,
  HighLatitudeRule,
  Madhab,
  PrayerTimes,
} from "adhan";

import {
  type CalculationMethodId,
  type MadhabId,
} from "../schemas/prayer-times";

export type PrayerKey =
  | "fajr"
  | "sunrise"
  | "dhuhr"
  | "asr"
  | "maghrib"
  | "isha";

export type PrayerInstant = { key: PrayerKey; time: Date | null };
export type PrayerDay = { date: Date; instants: PrayerInstant[] };

// Prayers shown on the arc/timetable, in chronological order.
const PRAYER_ORDER: PrayerKey[] = [
  "fajr",
  "sunrise",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
];

// Sunrise is a marker, not a prayer — excluded from "next prayer" countdown.
const COUNTDOWN_ORDER: Exclude<PrayerKey, "sunrise">[] = [
  "fajr",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
];

const DAY_MS = 24 * 60 * 60 * 1000;

function methodFactory(method: CalculationMethodId): CalculationParameters {
  switch (method) {
    case "MuslimWorldLeague":
      return CalculationMethod.MuslimWorldLeague();
    case "Egyptian":
      return CalculationMethod.Egyptian();
    case "Karachi":
      return CalculationMethod.Karachi();
    case "UmmAlQura":
      return CalculationMethod.UmmAlQura();
    case "Dubai":
      return CalculationMethod.Dubai();
    case "MoonsightingCommittee":
      return CalculationMethod.MoonsightingCommittee();
    case "NorthAmerica":
      return CalculationMethod.NorthAmerica();
    case "Kuwait":
      return CalculationMethod.Kuwait();
    case "Qatar":
      return CalculationMethod.Qatar();
    case "Singapore":
      return CalculationMethod.Singapore();
    case "Turkey":
      return CalculationMethod.Turkey();
    case "Tehran":
      return CalculationMethod.Tehran();
    default: {
      const _exhaustive: never = method;
      throw new Error(`Unhandled calculation method: ${String(_exhaustive)}`);
    }
  }
}

function validDate(d: Date | null | undefined): Date | null {
  return d != null && !Number.isNaN(d.getTime()) ? d : null;
}

export function computePrayerTimes(input: {
  lat: number;
  lng: number;
  date: Date;
  method: CalculationMethodId;
  madhab: MadhabId;
}): PrayerDay {
  const coords = new Coordinates(input.lat, input.lng);
  const params = methodFactory(input.method);
  params.madhab = input.madhab === "hanafi" ? Madhab.Hanafi : Madhab.Shafi;
  params.highLatitudeRule = HighLatitudeRule.recommended(coords);

  const pt = new PrayerTimes(coords, input.date, params);
  const raw: Record<PrayerKey, Date | null | undefined> = {
    fajr: pt.fajr,
    sunrise: pt.sunrise,
    dhuhr: pt.dhuhr,
    asr: pt.asr,
    maghrib: pt.maghrib,
    isha: pt.isha,
  };

  return {
    date: input.date,
    instants: PRAYER_ORDER.map((key) => ({ key, time: validDate(raw[key]) })),
  };
}

export type NextPrayer = {
  key: Exclude<PrayerKey, "sunrise">;
  time: Date;
  msUntil: number;
};

// First countdown-prayer strictly after `now` within this day, or null if `now`
// is past Isha.
export function getNextPrayer(day: PrayerDay, now: Date): NextPrayer | null {
  for (const key of COUNTDOWN_ORDER) {
    const time = day.instants.find((i) => i.key === key)?.time ?? null;
    if (time != null && time.getTime() > now.getTime()) {
      return { key, time, msUntil: time.getTime() - now.getTime() };
    }
  }
  return null;
}

// The prayer the UI counts down to — rolls over to tomorrow's Fajr after Isha.
export function getUpcomingPrayer(
  input: {
    lat: number;
    lng: number;
    method: CalculationMethodId;
    madhab: MadhabId;
  },
  now: Date,
): NextPrayer {
  const today = computePrayerTimes({ ...input, date: now });
  const next = getNextPrayer(today, now);
  if (next) return next;

  const tomorrow = computePrayerTimes({
    ...input,
    date: new Date(now.getTime() + DAY_MS),
  });
  const fajr = tomorrow.instants.find((i) => i.key === "fajr")?.time;
  if (fajr == null) {
    // Degenerate high-latitude fallback: point at the day boundary.
    const midnight = new Date(now.getTime() + DAY_MS);
    return { key: "fajr", time: midnight, msUntil: DAY_MS };
  }
  return { key: "fajr", time: fajr, msUntil: fajr.getTime() - now.getTime() };
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

// Position of the currently-visible celestial body along the arc, and whether
// it's the moon. The arc's dots run Fajr (far left) → Isha (far right). The SUN
// is shown during the day (Fajr → Isha) and rides the arc left→right, landing on
// each prayer dot. The MOON is shown at night (Isha → next Fajr) and rides the
// arc the other way — entering at the Isha point (right), peaking at the apex
// around solar midnight, and setting at the Fajr point (left) — so it always
// sits *between* the Isha and Fajr dots. The handoffs are seamless: at Isha both
// bodies are at the right edge, at Fajr both at the left edge.
//
// `fraction` is the left→right arc position (0 = Fajr/left, 1 = Isha/right). The
// night window straddles the calendar boundary, so this needs the location +
// params (not just a single PrayerDay) to reach into the adjacent day.
export function getArcPosition(
  input: {
    lat: number;
    lng: number;
    method: CalculationMethodId;
    madhab: MadhabId;
  },
  now: Date,
): { isNight: boolean; fraction: number } {
  const today = computePrayerTimes({ ...input, date: now });
  const fajr = today.instants.find((i) => i.key === "fajr")?.time ?? null;
  const isha = today.instants.find((i) => i.key === "isha")?.time ?? null;

  // Daytime: Fajr ≤ now < Isha — sun rides Fajr(left) → Isha(right).
  if (
    fajr != null &&
    isha != null &&
    now.getTime() >= fajr.getTime() &&
    now.getTime() < isha.getTime()
  ) {
    return { isNight: false, fraction: getDayProgress(today, now) };
  }

  // After Isha: night runs until *tomorrow's* Fajr. The moon descends from the
  // Isha point (fraction 1) back toward Fajr (fraction 0), so fraction = 1 − p.
  if (isha != null && now.getTime() >= isha.getTime()) {
    const tom = computePrayerTimes({
      ...input,
      date: new Date(now.getTime() + DAY_MS),
    });
    const end = tom.instants.find((i) => i.key === "fajr")?.time ?? fajr;
    if (end == null) return { isNight: true, fraction: 1 };
    const p = clamp01(
      (now.getTime() - isha.getTime()) / (end.getTime() - isha.getTime()),
    );
    return { isNight: true, fraction: 1 - p };
  }

  // Pre-dawn: still the night that began at *yesterday's* Isha.
  if (fajr != null && now.getTime() < fajr.getTime()) {
    const yest = computePrayerTimes({
      ...input,
      date: new Date(now.getTime() - DAY_MS),
    });
    const start = yest.instants.find((i) => i.key === "isha")?.time ?? isha;
    if (start == null) return { isNight: true, fraction: 0 };
    const p = clamp01(
      (now.getTime() - start.getTime()) / (fajr.getTime() - start.getTime()),
    );
    return { isNight: true, fraction: 1 - p };
  }

  return { isNight: true, fraction: 0.5 };
}

// Position of the sun along the day, anchored Fajr(0) → Isha(1), clamped.
export function getDayProgress(day: PrayerDay, now: Date): number {
  const fajr = day.instants.find((i) => i.key === "fajr")?.time ?? null;
  const isha = day.instants.find((i) => i.key === "isha")?.time ?? null;
  if (fajr == null || isha == null || isha.getTime() <= fajr.getTime()) {
    return 0.5;
  }
  const t =
    (now.getTime() - fajr.getTime()) / (isha.getTime() - fajr.getTime());
  return Math.min(1, Math.max(0, t));
}
