// Mirrors apps/web/features/prayer-times/hooks/use-prayer-settings.ts but uses
// AsyncStorage instead of localStorage.

import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { emitSettingsChanged, onSettingsChanged } from "@/lib/settings-bus";
import {
  LOCATION_KEY,
  PREFS_KEY,
  readLocation,
  readPrefs,
} from "@/features/prayer-times/lib/prayer-settings-store";

import {
  type CalculationMethodId,
  type MadhabId,
  type PrayerLocation,
  type PrayerPreferences,
  DEFAULT_LOCATION,
  DEFAULT_MADHAB,
  DEFAULT_METHOD,
} from "@repo/shared-core/schemas/prayer-times";

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
    const hydrate = () =>
      Promise.all([readLocation(), readPrefs()]).then(([loc, p]) => {
        setLocationState(loc);
        setPrefsState(p);
        setHydrated(true);
      });
    void hydrate();
    // Re-read when another instance (onboarding gate, prayer screen) writes.
    return onSettingsChanged(() => void hydrate());
  }, []);

  const setLocation = useCallback((loc: PrayerLocation) => {
    setLocationState(loc);
    void AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(loc))
      .then(emitSettingsChanged)
      .catch(() => {});
  }, []);

  const persistPrefs = useCallback((next: PrayerPreferences) => {
    setPrefsState(next);
    void AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next))
      .then(emitSettingsChanged)
      .catch(() => {});
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
