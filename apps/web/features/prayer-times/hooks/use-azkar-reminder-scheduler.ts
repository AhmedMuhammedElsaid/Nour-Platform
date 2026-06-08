"use client";

import { useEffect, useRef } from "react";

import type { AzkarReminderSettings } from "@repo/api/schemas/prayer-times";
import type { PrayerLocation, PrayerPreferences } from "@repo/api/schemas/prayer-times";
import { computePrayerTimes } from "@repo/api/services/prayer-times";

import {
  type AzkarReminderEvent,
  nextAzkarReminderEvent,
} from "../lib/azkar-reminder-schedule";

// Recompute at least this often so clock drift / sleep / background throttling
// can't push the fire time out by more than one chunk; the last leg is armed to
// the exact remaining ms so it lands on the second.
const MAX_CHUNK = 5 * 60_000; // 5 min
const FINAL_WINDOW = 30_000; // last 30s: arm the precise timeout

function clampChunk(ms: number): number {
  return Math.min(MAX_CHUNK, Math.max(1_000, ms));
}

// Foreground engine for azkar reminders: arms a single setTimeout to the next
// enabled event, fires onFire, then re-arms. Mirrors useAdhanScheduler but is
// kept separate — the two work on different event/settings types and decoupling
// keeps each scheduler independently testable.
export function useAzkarReminderScheduler(input: {
  settings: AzkarReminderSettings;
  location: PrayerLocation;
  prefs: PrayerPreferences;
  enabled: boolean;
  onFire: (event: AzkarReminderEvent) => void;
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
      const event = nextAzkarReminderEvent(day.instants, settings, now);

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
        // time, so sleep / background throttling can't push the fire time out.
        timer = setTimeout(arm, clampChunk(remaining - FINAL_WINDOW));
        return;
      }

      // Final window — arm the exact remaining delay so it fires on the second.
      timer = setTimeout(() => {
        onFireRef.current(event);
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
