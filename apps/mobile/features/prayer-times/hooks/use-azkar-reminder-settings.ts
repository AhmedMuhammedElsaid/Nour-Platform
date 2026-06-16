// Mirrors apps/web/features/prayer-times/hooks/use-azkar-reminder-settings.ts
// but uses AsyncStorage instead of localStorage. Storage key mirrors the web's
// `nour.azkar.reminder` so behaviour matches. Device-local only — no server.

import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { emitSettingsChanged, onSettingsChanged } from "@/lib/settings-bus";

import {
  type AzkarReminderSettings,
  DEFAULT_AZKAR_REMINDER_SETTINGS,
  azkarReminderSettingsSchema,
} from "@repo/shared-core/schemas/prayer-times";

const STORAGE_KEY = "nour.azkar.reminder";

async function readSettings(): Promise<AzkarReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AZKAR_REMINDER_SETTINGS;
    const parsed = azkarReminderSettingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_AZKAR_REMINDER_SETTINGS;
  } catch {
    return DEFAULT_AZKAR_REMINDER_SETTINGS;
  }
}

export type AzkarReminderSettingsApi = {
  settings: AzkarReminderSettings;
  hydrated: boolean;
  setEnabled: (enabled: boolean) => void;
  setOffset: (offsetMinutes: number) => void;
};

export function useAzkarReminderSettings(): AzkarReminderSettingsApi {
  const [settings, setSettings] = useState<AzkarReminderSettings>(
    DEFAULT_AZKAR_REMINDER_SETTINGS,
  );
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

  const persist = useCallback((next: AzkarReminderSettings) => {
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
  const setOffset = useCallback(
    (offsetMinutes: number) => {
      void readSettings().then((s) => persist({ ...s, offsetMinutes }));
    },
    [persist],
  );

  return { settings, hydrated, setEnabled, setOffset };
}
