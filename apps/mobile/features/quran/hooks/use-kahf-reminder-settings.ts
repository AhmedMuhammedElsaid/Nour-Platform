// Friday Surah Al-Kahf reminder preference. Mirrors
// use-azkar-reminder-settings.ts (AsyncStorage + settings-bus); storage key
// `nour.kahf.reminder` is a cross-surface contract with the extension.
// Device-local only — no server.

import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { emitSettingsChanged, onSettingsChanged } from "@/lib/settings-bus";

import {
  type KahfReminderSettings,
  DEFAULT_KAHF_REMINDER_SETTINGS,
  kahfReminderSettingsSchema,
} from "@repo/shared-core/schemas/prayer-times";

const STORAGE_KEY = "nour.kahf.reminder";

async function readSettings(): Promise<KahfReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_KAHF_REMINDER_SETTINGS;
    const parsed = kahfReminderSettingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_KAHF_REMINDER_SETTINGS;
  } catch {
    return DEFAULT_KAHF_REMINDER_SETTINGS;
  }
}

export type KahfReminderSettingsApi = {
  settings: KahfReminderSettings;
  hydrated: boolean;
  setEnabled: (enabled: boolean) => void;
};

export function useKahfReminderSettings(): KahfReminderSettingsApi {
  const [settings, setSettings] = useState<KahfReminderSettings>(
    DEFAULT_KAHF_REMINDER_SETTINGS,
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

  const setEnabled = useCallback((enabled: boolean) => {
    // Re-read before mutating so concurrent writers don't clobber each other.
    void readSettings().then((s) => {
      const next = { ...s, enabled };
      setSettings(next);
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        .then(emitSettingsChanged)
        .catch(() => {});
    });
  }, []);

  return { settings, hydrated, setEnabled };
}
