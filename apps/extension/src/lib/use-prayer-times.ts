import { useEffect, useState } from "react";

import {
  computePrayerTimes,
  getArcPosition,
  getUpcomingPrayer,
  type NextPrayer,
  type PrayerDay,
} from "@repo/shared-core/prayer-times/compute";

import { useLocation, usePrefs } from "../options/use-settings";

export type PrayerTimesState = {
  today: PrayerDay;
  upcoming: NextPrayer;
  arcPos: { isNight: boolean; onNightBand: boolean; fraction: number };
  now: Date;
};

// Derives live prayer-times state from storage settings. Ticks every second so
// the countdown stays current. Returns null while storage is still loading.
export function usePrayerTimes(): PrayerTimesState | null {
  const { location } = useLocation();
  const { prefs } = usePrefs();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);

  if (!location || !prefs) return null;

  const input = {
    lat: location.lat,
    lng: location.lng,
    method: prefs.method,
    madhab: prefs.madhab,
  };
  const today = computePrayerTimes({ ...input, date: now });
  const upcoming = getUpcomingPrayer(input, now);
  const arcPos = getArcPosition(input, now);

  return { today, upcoming, arcPos, now };
}
