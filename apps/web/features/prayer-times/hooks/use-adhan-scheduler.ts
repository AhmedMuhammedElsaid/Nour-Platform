"use client";

import { useEffect, useRef } from "react";

import type { AdhanSettings } from "@repo/api/schemas/prayer-times";
import type { PrayerLocation, PrayerPreferences } from "@repo/api/schemas/prayer-times";
import { computePrayerTimes } from "@repo/api/services/prayer-times";

import {
  type AdhanEvent,
  nextAdhanEvent,
  recentlyMissedAdhan,
} from "../lib/adhan-schedule";

// Recompute at least this often so clock drift / sleep / background throttling
// can't push the fire time out by more than one chunk; the last leg is armed to
// the exact remaining ms so it lands on the second.
const MAX_CHUNK = 5 * 60_000; // 5 min
const FINAL_WINDOW = 30_000; // last 30s: arm the precise timeout
// When the tab regains focus (or wakes from sleep), play an adhan whose time
// passed within this window but that we never got to fire — keeps it "on time"
// to within ~2 min instead of silently skipping it.
const CATCH_UP_WINDOW = 2 * 60_000; // 2 min

function clampChunk(ms: number): number {
  return Math.min(MAX_CHUNK, Math.max(1_000, ms));
}

// The dedupe marker must survive reloads AND be shared across tabs/installed-
// PWA windows. With only the effect-closure `lastFiredAt`, a reload (or the SW
// controllerchange reload) within the catch-up window refired the same adhan,
// and every open window played its own copy at prayer time — the "two azans at
// Fajr" bug. localStorage is per-origin, so one fire marks it for all windows.
const LAST_FIRED_KEY = "nour.prayer.adhan.lastFired";

function readLastFired(): string | null {
  try {
    return window.localStorage.getItem(LAST_FIRED_KEY);
  } catch {
    return null;
  }
}

function writeLastFired(id: string): void {
  try {
    window.localStorage.setItem(LAST_FIRED_KEY, id);
  } catch {
    /* storage unavailable — the closure dedupe still applies */
  }
}

// Arms a single setTimeout to the next enabled adhan event. On fire it invokes
// onFire(event), then re-arms. Re-runs whenever settings/location/prefs change.
// Cross-day rollover: when no event remains today, it sleeps to just after
// midnight and recomputes.
export function useAdhanScheduler(input: {
  settings: AdhanSettings;
  location: PrayerLocation;
  prefs: PrayerPreferences;
  enabled: boolean; // gate (e.g. only after hydration)
  onFire: (event: AdhanEvent) => void;
}) {
  const onFireRef = useRef(input.onFire);
  onFireRef.current = input.onFire;

  const { settings, location, prefs, enabled } = input;

  useEffect(() => {
    if (!enabled || !settings.enabled) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    // ISO time of the last adhan we played — dedups across re-arms, catch-up,
    // and tab-focus recomputes so the same prayer never fires twice.
    let lastFiredAt: string | null = null;

    const fire = (event: AdhanEvent) => {
      const id = event.time.toISOString();
      if (lastFiredAt === id || readLastFired() === id) return;
      lastFiredAt = id;
      writeLastFired(id);
      onFireRef.current(event);
    };

    const arm = (allowCatchUp = false) => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      const now = new Date();
      const day = computePrayerTimes({
        lat: location.lat,
        lng: location.lng,
        date: now,
        method: prefs.method,
        madhab: prefs.madhab,
      });

      // On wake/refocus, recover an adhan whose time just passed while we were
      // throttled — but only if it's still close enough to count as "on time".
      if (allowCatchUp) {
        const missed = recentlyMissedAdhan(
          day.instants,
          settings,
          now,
          CATCH_UP_WINDOW,
        );
        if (missed) fire(missed);
      }

      const event = nextAdhanEvent(day.instants, settings, now);

      if (!event) {
        // Nothing left today — wake just after midnight and recompute.
        const tomorrow = new Date(now);
        tomorrow.setHours(24, 0, 30, 0);
        timer = setTimeout(arm, clampChunk(tomorrow.getTime() - now.getTime()));
        return;
      }

      const remaining = event.time.getTime() - now.getTime();
      if (remaining > FINAL_WINDOW) {
        // Far out: nap in capped chunks and recompute from the live clock each
        // time. This self-corrects after laptop sleep or background throttling
        // (a single multi-hour setTimeout would otherwise fire late on wake).
        timer = setTimeout(arm, clampChunk(remaining - FINAL_WINDOW));
        return;
      }

      // Final window — arm the exact remaining delay so it fires on the second.
      timer = setTimeout(() => {
        fire(event);
        // Re-arm a second later so we don't refire the same instant.
        timer = setTimeout(arm, 1_000);
      }, Math.max(0, remaining));
    };

    // Returning to the tab (or waking the device) re-arms immediately and
    // catches up a just-missed adhan, instead of waiting out a throttled timer.
    const onWake = () => {
      if (document.visibilityState === "visible") arm(true);
    };

    arm();
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [
    enabled,
    settings,
    location.lat,
    location.lng,
    prefs.method,
    prefs.madhab,
  ]);
}
