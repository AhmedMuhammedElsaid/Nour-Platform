"use client";

import { useEffect, useRef } from "react";

import type { AzkarReminderSettings } from "@repo/api/schemas/prayer-times";
import type { PrayerLocation, PrayerPreferences } from "@repo/api/schemas/prayer-times";
import { computePrayerTimes } from "@repo/api/services/prayer-times";

import {
  type AzkarReminderEvent,
  nextAzkarReminderEvent,
} from "../lib/azkar-reminder-schedule";

const MAX_TIMEOUT = 2_147_483_647; // setTimeout 32-bit ceiling (~24.8 days)

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
        const delay = Math.min(MAX_TIMEOUT, tomorrow.getTime() - now.getTime());
        timer = setTimeout(arm, Math.max(1_000, delay));
        return;
      }

      const delay = Math.min(MAX_TIMEOUT, event.time.getTime() - now.getTime());
      timer = setTimeout(() => {
        onFireRef.current(event);
        timer = setTimeout(arm, 1_000);
      }, Math.max(0, delay));
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
