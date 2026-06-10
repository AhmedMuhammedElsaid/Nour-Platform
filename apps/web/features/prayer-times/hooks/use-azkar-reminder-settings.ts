"use client";

import { useCallback, useEffect, useState } from "react";

import {
  type AzkarReminderSettings,
  DEFAULT_AZKAR_REMINDER_SETTINGS,
  azkarReminderSettingsSchema,
} from "@repo/api/schemas/prayer-times";
import { readDeviceStore, writeDeviceStore } from "@/lib/device-store";

const STORAGE_KEY = "nour.azkar.reminder";

function readSettings(): AzkarReminderSettings {
  return readDeviceStore(STORAGE_KEY, azkarReminderSettingsSchema, DEFAULT_AZKAR_REMINDER_SETTINGS);
}

export type AzkarReminderSettingsApi = {
  settings: AzkarReminderSettings;
  hydrated: boolean;
  setEnabled: (enabled: boolean) => void;
  setOffset: (offsetMinutes: number) => void;
};

export function useAzkarReminderSettings(): AzkarReminderSettingsApi {
  // Server + first client render use defaults to avoid hydration mismatch.
  const [settings, setSettings] = useState<AzkarReminderSettings>(
    DEFAULT_AZKAR_REMINDER_SETTINGS,
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(readSettings());
    setHydrated(true);
  }, []);

  const persist = useCallback((next: AzkarReminderSettings) => {
    setSettings(next);
    writeDeviceStore(STORAGE_KEY, next);
  }, []);

  const setEnabled = useCallback(
    (enabled: boolean) => persist({ ...readSettings(), enabled }),
    [persist],
  );
  const setOffset = useCallback(
    (offsetMinutes: number) => persist({ ...readSettings(), offsetMinutes }),
    [persist],
  );

  return { settings, hydrated, setEnabled, setOffset };
}
