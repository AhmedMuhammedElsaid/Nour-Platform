// Registers launcher quick actions (long-press the app icon) for the Sabah and
// Masaa adhkar readers. The user can drag either item onto the home screen as a
// standalone icon. Taps route through expo-quick-actions' router integration,
// which pushes `params.href` on warm AND cold starts.

import { useEffect } from "react";
import { Platform } from "react-native";
import { useTranslation } from "react-i18next";
import * as QuickActions from "expo-quick-actions";
import { useQuickActionRouting } from "expo-quick-actions/router";

import { useAzkarReminderSettings } from "./use-azkar-reminder-settings";

// Android drawable key from the app.json expo-quick-actions plugin config.
// iOS would interpret the string as an asset/symbol name, so omit it there.
const ICON = Platform.select({ android: "shortcut_adhkar", default: undefined });

export function useAdhkarQuickActions(): void {
  useQuickActionRouting();

  const { t } = useTranslation();
  const { settings, hydrated } = useAzkarReminderSettings();
  const sabahSlug = settings.sabah.ar;
  const masaaSlug = settings.masaa.ar;

  useEffect(() => {
    if (!hydrated) return;
    // Stable ids: a user-pinned shortcut is keyed by id, so re-running setItems
    // updates it in place instead of orphaning it. Titles are always Arabic
    // (Arabic dhikr), matching the reminder notifications.
    void QuickActions.setItems([
      {
        id: "sabah",
        title: t("prayer.azkar.sabah.title", { lng: "ar" }),
        icon: ICON,
        params: { href: `/adhkar/${encodeURIComponent(sabahSlug)}` },
      },
      {
        id: "masaa",
        title: t("prayer.azkar.masaa.title", { lng: "ar" }),
        icon: ICON,
        params: { href: `/adhkar/${encodeURIComponent(masaaSlug)}` },
      },
    ]).catch(() => {});
  }, [hydrated, t, sabahSlug, masaaSlug]);
}
