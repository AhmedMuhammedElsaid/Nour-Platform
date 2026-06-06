"use client";

import { useCallback, useEffect, useState } from "react";

import {
  type CalculationMethodId,
  type MadhabId,
  type PrayerLocation,
  type PrayerPreferences,
  DEFAULT_LOCATION,
  DEFAULT_MADHAB,
  DEFAULT_METHOD,
  calculationMethodSchema,
  madhabSchema,
  prayerLocationSchema,
} from "@repo/api/schemas/prayer-times";

const LOCATION_KEY = "nour.prayer.location";
const PREFS_KEY = "nour.prayer.prefs";

function readLocation(): PrayerLocation {
  try {
    const raw = localStorage.getItem(LOCATION_KEY);
    if (!raw) return DEFAULT_LOCATION;
    const parsed = prayerLocationSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_LOCATION;
  } catch {
    return DEFAULT_LOCATION;
  }
}

function readPrefs(): PrayerPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { method: DEFAULT_METHOD, madhab: DEFAULT_MADHAB };
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const method = calculationMethodSchema.safeParse(obj.method);
    const madhab = madhabSchema.safeParse(obj.madhab);
    return {
      method: method.success ? method.data : DEFAULT_METHOD,
      madhab: madhab.success ? madhab.data : DEFAULT_MADHAB,
    };
  } catch {
    return { method: DEFAULT_METHOD, madhab: DEFAULT_MADHAB };
  }
}

export type PrayerSettings = {
  location: PrayerLocation;
  prefs: PrayerPreferences;
  hydrated: boolean;
  setLocation: (loc: PrayerLocation) => void;
  setMethod: (method: CalculationMethodId) => void;
  setMadhab: (madhab: MadhabId) => void;
};

export function usePrayerSettings(): PrayerSettings {
  // Server + first client render use defaults to avoid hydration mismatch.
  const [location, setLocationState] = useState<PrayerLocation>(DEFAULT_LOCATION);
  const [prefs, setPrefs] = useState<PrayerPreferences>({
    method: DEFAULT_METHOD,
    madhab: DEFAULT_MADHAB,
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLocationState(readLocation());
    setPrefs(readPrefs());
    setHydrated(true);
  }, []);

  const setLocation = useCallback((loc: PrayerLocation) => {
    setLocationState(loc);
    try {
      localStorage.setItem(LOCATION_KEY, JSON.stringify(loc));
    } catch {
      /* storage unavailable — keep in-memory state */
    }
  }, []);

  const persistPrefs = useCallback((next: PrayerPreferences) => {
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const setMethod = useCallback(
    (method: CalculationMethodId) => persistPrefs({ ...readPrefs(), method }),
    [persistPrefs],
  );
  const setMadhab = useCallback(
    (madhab: MadhabId) => persistPrefs({ ...readPrefs(), madhab }),
    [persistPrefs],
  );

  return { location, prefs, hydrated, setLocation, setMethod, setMadhab };
}
