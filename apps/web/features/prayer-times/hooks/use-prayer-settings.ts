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
  prayerLocationSchema,
  prayerPreferencesSchema,
} from "@repo/api/schemas/prayer-times";
import { readDeviceStore, writeDeviceStore } from "@/lib/device-store";

const LOCATION_KEY = "nour.prayer.location";
const PREFS_KEY = "nour.prayer.prefs";
const DEFAULT_PREFS: PrayerPreferences = { method: DEFAULT_METHOD, madhab: DEFAULT_MADHAB };

function readLocation(): PrayerLocation {
  return readDeviceStore(LOCATION_KEY, prayerLocationSchema, DEFAULT_LOCATION);
}

function readPrefs(): PrayerPreferences {
  return readDeviceStore(PREFS_KEY, prayerPreferencesSchema, DEFAULT_PREFS);
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
    writeDeviceStore(LOCATION_KEY, loc);
  }, []);

  const persistPrefs = useCallback((next: PrayerPreferences) => {
    setPrefs(next);
    writeDeviceStore(PREFS_KEY, next);
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
