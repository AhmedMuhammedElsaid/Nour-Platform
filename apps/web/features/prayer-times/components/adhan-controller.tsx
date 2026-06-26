"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import {
  ADHAN_PRAYER_KEYS,
  type AdhanPrayerKey,
} from "@repo/api/schemas/prayer-times";

import { ensurePrayerMonth, resolvePrayerDay } from "../lib/aladhan";
import { usePrayerSettings } from "../hooks/use-prayer-settings";
import { useAdhanSettings } from "../hooks/use-adhan-settings";
import { useAdhanScheduler } from "../hooks/use-adhan-scheduler";
import { scheduleAdhanNotifications } from "../lib/adhan-notifications";
import { ADHAN_FIRED_KEY, claimFiredEvent } from "../lib/fired-event-store";
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
  // Schedule the next ~48h (today + tomorrow) so closed-tab delivery survives
  // past the last prayer of today, where supported (Chromium); iOS/Firefox fall
  // back to the foreground-only Layer A above.
  useEffect(() => {
    if (!ready || !settings.enabled) return;
    let cancelled = false;
    const now = new Date();
    const params = {
      lat: location.lat,
      lng: location.lng,
      method: prefs.method,
      madhab: prefs.madhab,
    };
    const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    void (async () => {
      // Warm the Aladhan month cache so both this Layer-B schedule AND the
      // Layer-A foreground scheduler fire on the authoritative minute. The
      // ensure* calls no-op once cached and fall back to adhan-js offline.
      await Promise.all([
        ensurePrayerMonth({ ...params, date: now }),
        ensurePrayerMonth({ ...params, date: tomorrowDate }),
      ]);
      if (cancelled) return;
      const today = resolvePrayerDay({ ...params, date: now });
      const tomorrow = resolvePrayerDay({ ...params, date: tomorrowDate });
      await scheduleAdhanNotifications(
        [...today.instants, ...tomorrow.instants],
        settings,
        (k) => t(k),
      );
    })();
    return () => {
      cancelled = true;
    };
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

  // Notification click → SW postMessage → play in-page. Shares the durable
  // fired-event claim with the foreground scheduler so a click can't replay an
  // adhan the catch-up (or another tab) already played.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
    const handler = (e: MessageEvent) => {
      const data = e.data as { type?: string; adhanKey?: unknown } | null;
      if (data?.type !== "adhan:play" || !isAdhanKey(data.adhanKey)) return;
      const key = data.adhanKey;
      const play = () => player.current?.play(key, settings.volume).catch(() => {});
      // Must use the same source as the scheduler so the fired-event claim key
      // (the prayer instant's ISO) matches — otherwise a click could replay an
      // adhan the scheduler already claimed.
      const day = resolvePrayerDay({
        lat: location.lat,
        lng: location.lng,
        date: new Date(),
        method: prefs.method,
        madhab: prefs.madhab,
      });
      const iso = day.instants
        .find((i) => i.key === key)
        ?.time?.toISOString();
      if (!iso) {
        play();
        return;
      }
      void claimFiredEvent(ADHAN_FIRED_KEY, iso).then((owned) => {
        if (owned) play();
      });
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [settings.volume, location.lat, location.lng, prefs.method, prefs.madhab]);

  return <AdhanPlayer ref={player} />;
}
