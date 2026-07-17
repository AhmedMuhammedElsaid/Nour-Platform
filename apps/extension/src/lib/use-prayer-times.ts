import { useEffect, useMemo, useState } from "react";

import {
  getArcPosition,
  getNextPrayer,
  type NextPrayer,
  type PrayerDay,
} from "@repo/shared-core/prayer-times/compute";

import {
  loadPrayerMonth,
  resolveDayFrom,
  warmPrayerMonth,
  watchPrayerMonth,
  type PrayerMonth,
} from "./aladhan";
import { useLocation, usePrefs } from "../options/use-settings";

export type PrayerTimesState = {
  today: PrayerDay;
  upcoming: NextPrayer;
  arcPos: { isNight: boolean; onNightBand: boolean; fraction: number };
  now: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Derives live prayer-times state from storage settings. Ticks every second so
// the countdown stays current. Returns null while storage is still loading.
//
// Times resolve through the SAME Aladhan month cache the background scheduler
// fires on (official minute when warm, adhan-js until then) — the timetable,
// the arc/moon, and the adhan must share one time source or they diverge by
// the ±1 min adhan-js/Aladhan gap (the moon-stuck-before-Fajr bug class).
export function usePrayerTimes(): PrayerTimesState | null {
  const { location } = useLocation();
  const { prefs } = usePrefs();
  const [now, setNow] = useState(() => new Date());
  const [month, setMonth] = useState<PrayerMonth | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Load the cached Aladhan month (and warm it if cold) whenever the settings
  // or the calendar month change; keep it live if another context (background
  // tick, second newtab) fetches it first. `monthStamp` rolls the effect over
  // at midnight into a new month.
  const monthStamp = `${now.getFullYear()}-${now.getMonth() + 1}`;
  useEffect(() => {
    if (!location || !prefs) return;
    const params = {
      lat: location.lat,
      lng: location.lng,
      method: prefs.method,
      madhab: prefs.madhab,
      date: new Date(),
    };
    let cancelled = false;
    const apply = (m: PrayerMonth | null) => {
      if (!cancelled && m != null) setMonth(m);
    };
    setMonth(null); // params changed — don't resolve against the old city/month
    void loadPrayerMonth(params).then((m) => {
      apply(m);
      if (m == null) return warmPrayerMonth(params).then(apply);
    });
    const unwatch = watchPrayerMonth(params, apply);
    return () => {
      cancelled = true;
      unwatch();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.lat, location?.lng, prefs?.method, prefs?.madhab, monthStamp]);

  const state = useMemo(() => {
    if (!location || !prefs) return null;

    const input = {
      lat: location.lat,
      lng: location.lng,
      method: prefs.method,
      madhab: prefs.madhab,
    };
    const resolveDay = (date: Date): PrayerDay =>
      resolveDayFrom(month, { ...input, date });

    const today = resolveDay(now);
    // Roll to tomorrow's Fajr through the SAME resolver (mirrors the web
    // widget); adhan-js getUpcomingPrayer would be a second time source.
    const upcoming: NextPrayer =
      getNextPrayer(today, now) ??
      nextFajr(resolveDay, now) ??
      // Unreachable in practice (a resolved day always has a finite Fajr);
      // satisfies the non-null contract without widening the type.
      { key: "fajr", time: new Date(now.getTime() + DAY_MS), msUntil: DAY_MS };
    const arcPos = getArcPosition(resolveDay, now);

    return { today, upcoming, arcPos, now };
  }, [location, prefs, month, now]);

  return state;
}

function nextFajr(
  resolveDay: (date: Date) => PrayerDay,
  now: Date,
): NextPrayer | null {
  const tomorrow = resolveDay(new Date(now.getTime() + DAY_MS));
  const time = tomorrow.instants.find((i) => i.key === "fajr")?.time ?? null;
  if (time == null || time.getTime() <= now.getTime()) return null;
  return { key: "fajr", time, msUntil: time.getTime() - now.getTime() };
}
