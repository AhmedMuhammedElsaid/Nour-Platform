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

  // Prime the audio elements on the first user gesture anywhere on the site.
  // Without this the browser autoplay policy blocks every scheduled play()
  // (the elements were never user-activated), so the adhan stays silent.
  useEffect(() => {
    const unlock = () => player.current?.unlock();
    const opts = { once: true, passive: true } as const;
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("keydown", unlock, opts);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // The adhan mp3s (~13.5 MB) are no longer precached for every visitor — ask
  // the service worker to cache them once azan is actually enabled, so timed
  // playback works offline too. The SW skips files it already has; no-op in
  // dev (no SW registered) and on browsers without service workers.
  useEffect(() => {
    if (!ready || !settings.enabled) return;
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
    void navigator.serviceWorker.ready.then((reg) => {
      reg.active?.postMessage({ type: "nour:cache-adhan" });
    });
  }, [ready, settings.enabled]);

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

  // Test hook (?test=1 button): play immediately. The click is a user gesture
  // so autoplay is allowed even before the first scroll/keypress.
  useEffect(() => {
    const onTest = () => {
      player.current?.unlock();
      player.current?.play("dhuhr", settings.volume).catch(() => {});
    };
    window.addEventListener("nour:test-adhan", onTest);
    return () => window.removeEventListener("nour:test-adhan", onTest);
  }, [settings.volume]);

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
