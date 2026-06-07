"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import {
  ADHAN_PRAYER_KEYS,
  type AdhanPrayerKey,
} from "@repo/api/schemas/prayer-times";
import { computePrayerTimes } from "@repo/api/services/prayer-times";

import { usePrayerSettings } from "../hooks/use-prayer-settings";
import { useAdhanSettings } from "../hooks/use-adhan-settings";
import { useAdhanScheduler } from "../hooks/use-adhan-scheduler";
import { scheduleAdhanNotifications } from "../lib/adhan-notifications";
import { AdhanPlayer, type AdhanPlayerHandle } from "./adhan-player";

function isAdhanKey(value: unknown): value is AdhanPrayerKey {
  return typeof value === "string" && (ADHAN_PRAYER_KEYS as readonly string[]).includes(value);
}

// Headless island mounted site-wide: drives Layer A (foreground autoplay) and
// re-schedules Layer B (background notifications) whenever settings change.
export function AdhanController() {
  const t = useTranslations("prayer");
  const player = useRef<AdhanPlayerHandle>(null);
  const { location, prefs, hydrated: prefsHydrated } = usePrayerSettings();
  const { settings, hydrated: adhanHydrated } = useAdhanSettings();
  const ready = prefsHydrated && adhanHydrated;

  // Layer A — foreground autoplay.
  useAdhanScheduler({
    settings,
    location,
    prefs,
    enabled: ready,
    onFire: (event) => {
      player.current?.play(event.key, settings.volume).catch(() => {
        // Autoplay blocked (tab never interacted with) — silent; Layer B
        // notification still fires where supported.
      });
    },
  });

  // Layer B — (re)schedule background notifications on settings/location change.
  useEffect(() => {
    if (!ready || !settings.enabled) return;
    const day = computePrayerTimes({
      lat: location.lat,
      lng: location.lng,
      date: new Date(),
      method: prefs.method,
      madhab: prefs.madhab,
    });
    void scheduleAdhanNotifications(day.instants, settings, (k) => t(k));
  }, [ready, settings, location.lat, location.lng, prefs.method, prefs.madhab, t]);

  // Notification click → SW postMessage → play in-page.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
    const handler = (e: MessageEvent) => {
      const data = e.data as { type?: string; adhanKey?: unknown } | null;
      if (data?.type === "adhan:play" && isAdhanKey(data.adhanKey)) {
        player.current?.play(data.adhanKey, settings.volume).catch(() => {});
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [settings.volume]);

  return <AdhanPlayer ref={player} />;
}
