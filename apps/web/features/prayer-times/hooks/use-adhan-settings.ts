"use client";

import { useCallback, useEffect, useState } from "react";

import {
  type AdhanPrayerKey,
  type AdhanSettings,
  DEFAULT_ADHAN_SETTINGS,
  adhanSettingsSchema,
} from "@repo/api/schemas/prayer-times";
import { readDeviceStore, writeDeviceStore } from "@/lib/device-store";

const ADHAN_KEY = "nour.prayer.adhan";

function readSettings(): AdhanSettings {
  return readDeviceStore(ADHAN_KEY, adhanSettingsSchema, DEFAULT_ADHAN_SETTINGS);
}

export type AdhanSettingsApi = {
  settings: AdhanSettings;
  hydrated: boolean;
  setEnabled: (enabled: boolean) => void;
  setPrayer: (key: AdhanPrayerKey, on: boolean) => void;
  setVolume: (volume: number) => void;
};

export function useAdhanSettings(): AdhanSettingsApi {
  // Server + first client render use defaults to avoid hydration mismatch.
  const [settings, setSettings] = useState<AdhanSettings>(DEFAULT_ADHAN_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(readSettings());
    setHydrated(true);
  }, []);

  const persist = useCallback((next: AdhanSettings) => {
    setSettings(next);
    writeDeviceStore(ADHAN_KEY, next);
  }, []);

  const setEnabled = useCallback(
    (enabled: boolean) => persist({ ...readSettings(), enabled }),
    [persist],
  );
  const setVolume = useCallback(
    (volume: number) => persist({ ...readSettings(), volume }),
    [persist],
  );
  const setPrayer = useCallback(
    (key: AdhanPrayerKey, on: boolean) => {
      const cur = readSettings();
      persist({ ...cur, perPrayer: { ...cur.perPrayer, [key]: on } });
    },
    [persist],
  );

  return { settings, hydrated, setEnabled, setPrayer, setVolume };
}
