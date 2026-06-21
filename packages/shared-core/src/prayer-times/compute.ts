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

// The arc's dots are placed on the Fajr(0)→Isha(1) track (see buildArcDots), so a
// body's `fraction` must use the SAME anchoring to land *on* a dot. This returns
// the Fajr→Isha fraction of an arbitrary instant for an arbitrary day — the moon
// uses it to start exactly on the Maghrib dot and finish on the Sunrise dot.
function dayTrackFraction(day: PrayerDay, t: Date): number {
  const fajr = day.instants.find((i) => i.key === "fajr")?.time ?? null;
  const isha = day.instants.find((i) => i.key === "isha")?.time ?? null;
  if (fajr == null || isha == null || isha.getTime() <= fajr.getTime()) return 0.5;
  return clamp01((t.getTime() - fajr.getTime()) / (isha.getTime() - fajr.getTime()));
}

// Position of the currently-visible celestial body along the arc, and whether
// it's the moon. The arc's dots run Fajr (far left) → Isha (far right).
//
// SUN — shown while it is literally up (Shrouq→Maghrib), riding the Fajr→Isha dot
// track (getDayProgress) so it lands on the Dhuhr/Asr dots and *sets exactly on
// the Maghrib dot*.
//
// MOON — shown at night (Maghrib → next Shrouq). It RISES on the Maghrib dot
// (where the sun just set — not at the far-right Isha horizon) and glides along
// the arc toward the opposite side, *setting on the next Sunrise/Shrouq dot* at
// dawn. So both handoffs are seamless: sun→moon on the Maghrib dot at dusk, and
// moon→sun on the Sunrise dot at dawn.
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
): { isNight: boolean; onNightBand: boolean; fraction: number } {
  const today = computePrayerTimes({ ...input, date: now });
  const sunrise = today.instants.find((i) => i.key === "sunrise")?.time ?? null;
  const maghrib = today.instants.find((i) => i.key === "maghrib")?.time ?? null;
  const isha = today.instants.find((i) => i.key === "isha")?.time ?? null;

  // Daytime: Sunrise ≤ now < Maghrib — the sun is up, riding the Fajr→Isha dot
  // track so it sits on each prayer dot and leaves exactly on the Maghrib dot.
  if (
    sunrise != null &&
    maghrib != null &&
    now.getTime() >= sunrise.getTime() &&
    now.getTime() < maghrib.getTime()
  ) {
    return { isNight: false, onNightBand: false, fraction: getDayProgress(today, now) };
  }

  // Dusk leg — Maghrib ≤ now < Isha: the moon rises on the SAME day arc the sun
  // just left (no axis jump), gliding from the Maghrib dot rightward to the Isha
  // dot. Only after Isha does it drop to the lower night band.
  if (
    maghrib != null &&
    isha != null &&
    now.getTime() >= maghrib.getTime() &&
    now.getTime() < isha.getTime()
  ) {
    const from = dayTrackFraction(today, maghrib);
    const to = dayTrackFraction(today, isha);
    const p = clamp01(
      (now.getTime() - maghrib.getTime()) / (isha.getTime() - maghrib.getTime()),
    );
    return { isNight: true, onNightBand: false, fraction: from + p * (to - from) };
  }

  // Night leg — after Isha: the moon sweeps the lower night band from the Isha
  // dot back toward dawn (*tomorrow's* Sunrise), the return journey on the
  // second axis.
  if (isha != null && now.getTime() >= isha.getTime()) {
    const tom = computePrayerTimes({
      ...input,
      date: new Date(now.getTime() + DAY_MS),
    });
    const end = tom.instants.find((i) => i.key === "sunrise")?.time ?? sunrise;
    const from = dayTrackFraction(today, isha);
    if (end == null) return { isNight: true, onNightBand: true, fraction: from };
    const to = dayTrackFraction(tom, end);
    const p = clamp01(
      (now.getTime() - isha.getTime()) / (end.getTime() - isha.getTime()),
    );
    return { isNight: true, onNightBand: true, fraction: from + p * (to - from) };
  }

  // Pre-dawn (before Sunrise): still the night band that began at *yesterday's*
  // Isha; the moon finishes its sweep onto the dawn Sunrise dot.
  if (sunrise != null && now.getTime() < sunrise.getTime()) {
    const yest = computePrayerTimes({
      ...input,
      date: new Date(now.getTime() - DAY_MS),
    });
    const start = yest.instants.find((i) => i.key === "isha")?.time ?? isha;
    const to = dayTrackFraction(today, sunrise);
    if (start == null) return { isNight: true, onNightBand: true, fraction: to };
    const from = dayTrackFraction(yest, start);
    const p = clamp01(
      (now.getTime() - start.getTime()) / (sunrise.getTime() - start.getTime()),
    );
    return { isNight: true, onNightBand: true, fraction: from + p * (to - from) };
  }

  return { isNight: true, onNightBand: true, fraction: 0.5 };
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
