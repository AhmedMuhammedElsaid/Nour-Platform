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
// is shown while it is literally up — Shrouq (sunrise) → Maghrib (sunset) — and
// rides the Fajr→Isha dot track (getDayProgress), so it still lands on the
// Dhuhr/Asr dots, entering near the Sunrise dot and leaving at the Maghrib dot.
// The MOON is shown at night (Maghrib → next Shrouq) and rides the arc the other
// way — entering at the right (fraction 1) near Maghrib, peaking around solar
// midnight, and setting at the left (fraction 0) at Sunrise. The handoffs land
// at Maghrib (both bodies at the right) and at Sunrise (both at the left).
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
  const sunrise = today.instants.find((i) => i.key === "sunrise")?.time ?? null;
  const maghrib = today.instants.find((i) => i.key === "maghrib")?.time ?? null;

  // Daytime: Sunrise ≤ now < Maghrib — the sun is up. The fraction spans the
  // visible day Sunrise(0)→Maghrib(1) — NOT Fajr→Isha — so the sun sits at the
  // far-right Maghrib dot exactly as it sets. The night branch then starts the
  // moon at fraction 1 (same spot), so the moon rises *where the sun disappears*
  // and travels back to the left, reaching Sunrise(0) at dawn — no jump.
  if (
    sunrise != null &&
    maghrib != null &&
    now.getTime() >= sunrise.getTime() &&
    now.getTime() < maghrib.getTime()
  ) {
    const p = clamp01(
      (now.getTime() - sunrise.getTime()) / (maghrib.getTime() - sunrise.getTime()),
    );
    return { isNight: false, fraction: p };
  }

  // After Maghrib: night runs until *tomorrow's* Sunrise. The moon descends from
  // the right (fraction 1) back toward the left (fraction 0), so fraction = 1 − p.
  if (maghrib != null && now.getTime() >= maghrib.getTime()) {
    const tom = computePrayerTimes({
      ...input,
      date: new Date(now.getTime() + DAY_MS),
    });
    const end = tom.instants.find((i) => i.key === "sunrise")?.time ?? sunrise;
    if (end == null) return { isNight: true, fraction: 1 };
    const p = clamp01(
      (now.getTime() - maghrib.getTime()) / (end.getTime() - maghrib.getTime()),
    );
    return { isNight: true, fraction: 1 - p };
  }

  // Pre-dawn (before Shrouq): still the night that began at *yesterday's* Maghrib.
  if (sunrise != null && now.getTime() < sunrise.getTime()) {
    const yest = computePrayerTimes({
      ...input,
      date: new Date(now.getTime() - DAY_MS),
    });
    const start = yest.instants.find((i) => i.key === "maghrib")?.time ?? maghrib;
    if (start == null) return { isNight: true, fraction: 0 };
    const p = clamp01(
      (now.getTime() - start.getTime()) / (sunrise.getTime() - start.getTime()),
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
