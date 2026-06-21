// React hook wrapping getPrayerDay. Starts with an instant local computation
// (so the UI never blocks), then upgrades to the Aladhan pre-computed times
// once the cache or network resolves — typically imperceptible if the month
// is already cached, ~500 ms on the first open of each month.

import { useEffect, useState } from "react";

import type { CalculationMethodId, MadhabId } from "@repo/shared-core/schemas/prayer-times";
import { computePrayerTimes, type PrayerDay } from "@repo/shared-core/prayer-times/compute";
import { getPrayerDay } from "../lib/aladhan";

export function usePrayerDay(
  lat: number,
  lng: number,
  method: CalculationMethodId,
  madhab: MadhabId,
  date: Date,
): PrayerDay {
  // Keyed on the calendar date, not the exact ms — prayer instants only change
  // at the day boundary, and the Date object ticks every second in the UI.
  const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

  const [day, setDay] = useState<PrayerDay>(() =>
    computePrayerTimes({ lat, lng, date, method, madhab }),
  );

  useEffect(() => {
    let cancelled = false;
    // Show local computation immediately so the UI isn't blank while we fetch.
    setDay(computePrayerTimes({ lat, lng, date, method, madhab }));
    // Then upgrade to Aladhan's authoritative times (cached after the first hit).
    void getPrayerDay(lat, lng, method, madhab, date).then((remote) => {
      if (!cancelled) setDay(remote);
    });
    return () => {
      cancelled = true;
    };
    // `date` object identity changes every second; depend on the calendar-date
    // string so the effect only re-runs on an actual day boundary or setting change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, method, madhab, dateStr]);

  return day;
}
