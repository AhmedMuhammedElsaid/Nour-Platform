// Mirrors apps/web/features/prayer-times/hooks/use-prayer-settings.ts but uses
// AsyncStorage instead of localStorage.

import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
} from "@repo/shared-core/schemas/prayer-times";

const LOCATION_KEY = "nour.prayer.location";
const PREFS_KEY = "nour.prayer.prefs";

async function readLocation(): Promise<PrayerLocation> {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_KEY);
    if (!raw) return DEFAULT_LOCATION;
    const parsed = prayerLocationSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_LOCATION;
  } catch {
    return DEFAULT_LOCATION;
  }
}

async function readPrefs(): Promise<PrayerPreferences> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
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
  const [location, setLocationState] = useState<PrayerLocation>(DEFAULT_LOCATION);
  const [prefs, setPrefsState] = useState<PrayerPreferences>({
    method: DEFAULT_METHOD,
    madhab: DEFAULT_MADHAB,
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void Promise.all([readLocation(), readPrefs()]).then(([loc, p]) => {
      setLocationState(loc);
      setPrefsState(p);
      setHydrated(true);
    });
  }, []);

  const setLocation = useCallback((loc: PrayerLocation) => {
    setLocationState(loc);
    void AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(loc)).catch(() => {});
  }, []);

  const persistPrefs = useCallback((next: PrayerPreferences) => {
    setPrefsState(next);
    void AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const setMethod = useCallback(
    (method: CalculationMethodId) => {
      void readPrefs().then((p) => persistPrefs({ ...p, method }));
    },
    [persistPrefs],
  );

  const setMadhab = useCallback(
    (madhab: MadhabId) => {
      void readPrefs().then((p) => persistPrefs({ ...p, madhab }));
    },
    [persistPrefs],
  );

  return { location, prefs, hydrated, setLocation, setMethod, setMadhab };
}
