"use client";

import { useEffect, useRef } from "react";

import type { AdhanSettings } from "@repo/api/schemas/prayer-times";
import type { PrayerLocation, PrayerPreferences } from "@repo/api/schemas/prayer-times";
import { computePrayerTimes } from "@repo/api/services/prayer-times";

import { type AdhanEvent, nextAdhanEvent } from "../lib/adhan-schedule";

// Recompute at least this often so clock drift / sleep / background throttling
// can't push the fire time out by more than one chunk; the last leg is armed to
// the exact remaining ms so it lands on the second.
const MAX_CHUNK = 5 * 60_000; // 5 min
const FINAL_WINDOW = 30_000; // last 30s: arm the precise timeout

function clampChunk(ms: number): number {
  return Math.min(MAX_CHUNK, Math.max(1_000, ms));
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

    const arm = () => {
      const now = new Date();
      const day = computePrayerTimes({
        lat: location.lat,
        lng: location.lng,
        date: now,
        method: prefs.method,
        madhab: prefs.madhab,
      });
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
        onFireRef.current(event);
        // Re-arm a second later so we don't refire the same instant.
        timer = setTimeout(arm, 1_000);
      }, Math.max(0, remaining));
    };

    arm();
    return () => {
      if (timer) clearTimeout(timer);
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
