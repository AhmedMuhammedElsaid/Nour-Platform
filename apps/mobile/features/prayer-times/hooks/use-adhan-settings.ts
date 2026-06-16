// Mirrors apps/web/features/prayer-times/hooks/use-adhan-settings.ts but uses
// AsyncStorage instead of localStorage. Storage key mirrors the web's
// `nour.prayer.adhan` so the adhan toggle persists across navigation/restarts.
// Device-local only — no server.

import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { emitSettingsChanged, onSettingsChanged } from "@/lib/settings-bus";

import {
  type AdhanPrayerKey,
  type AdhanSettings,
  DEFAULT_ADHAN_SETTINGS,
  adhanSettingsSchema,
} from "@repo/shared-core/schemas/prayer-times";

const STORAGE_KEY = "nour.prayer.adhan";

async function readSettings(): Promise<AdhanSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ADHAN_SETTINGS;
    const parsed = adhanSettingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_ADHAN_SETTINGS;
  } catch {
    return DEFAULT_ADHAN_SETTINGS;
  }
}

export type AdhanSettingsApi = {
  settings: AdhanSettings;
  hydrated: boolean;
  setEnabled: (enabled: boolean) => void;
  setPrayer: (key: AdhanPrayerKey, on: boolean) => void;
  setVolume: (volume: number) => void;
};

export function useAdhanSettings(): AdhanSettingsApi {
  const [settings, setSettings] = useState<AdhanSettings>(DEFAULT_ADHAN_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const hydrate = () =>
      readSettings().then((s) => {
        setSettings(s);
        setHydrated(true);
      });
    void hydrate();
    return onSettingsChanged(() => void hydrate());
  }, []);

  const persist = useCallback((next: AdhanSettings) => {
    setSettings(next);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      .then(emitSettingsChanged)
      .catch(() => {});
  }, []);

  // Re-read before each mutation so concurrent writers don't clobber each other
  // (matches the web hook's read-modify-write).
  const setEnabled = useCallback(
    (enabled: boolean) => {
      void readSettings().then((s) => persist({ ...s, enabled }));
    },
    [persist],
  );
  const setVolume = useCallback(
    (volume: number) => {
      void readSettings().then((s) => persist({ ...s, volume }));
    },
    [persist],
  );
  const setPrayer = useCallback(
    (key: AdhanPrayerKey, on: boolean) => {
      void readSettings().then((s) =>
        persist({ ...s, perPrayer: { ...s.perPrayer, [key]: on } }),
      );
    },
    [persist],
  );

  return { settings, hydrated, setEnabled, setPrayer, setVolume };
}
