"use client";

import { useEffect, useRef } from "react";

import type { AzkarReminderSettings } from "@repo/api/schemas/prayer-times";
import type { PrayerLocation, PrayerPreferences } from "@repo/api/schemas/prayer-times";
import { computePrayerTimes } from "@repo/api/services/prayer-times";

import {
  type AzkarReminderEvent,
  isAzkarReminderEventStale,
  nextAzkarReminderEvent,
} from "../lib/azkar-reminder-schedule";
import {
  AZKAR_REMINDER_FIRED_KEY,
  claimFiredEvent,
} from "../lib/fired-event-store";

// Recompute at least this often so clock drift / sleep / background throttling
// can't push the fire time out by more than one chunk; the last leg is armed to
// the exact remaining ms so it lands on the second.
const MAX_CHUNK = 5 * 60_000; // 5 min
const FINAL_WINDOW = 30_000; // last 30s: arm the precise timeout
// Drop a precise timer that resolved more than this late after sleep/throttling
// so it can't fire a reminder well after its time. The reminder fires ONLY when
// the live clock reaches its instant with the page open — opening or refocusing
// the tab never replays a reminder that already passed.
const STALE_GRACE = 2 * 60_000; // 2 min

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
    let cancelled = false;
    // Fast-path dedup within this closure; durable dedup in localStorage —
    // see fired-event-store.ts (closure resets + second tab can't double-fire).
    let lastFiredAt: string | null = null;

    const fire = (event: AzkarReminderEvent) => {
      const id = event.time.toISOString();
      if (lastFiredAt === id) return;
      // A precise timer paused during device sleep resumes on wake and resolves
      // its captured event late — drop any reminder more than the grace late so
      // a morning reminder can't fire hours later (mirrors the adhan scheduler).
      if (isAzkarReminderEventStale(event, new Date(), STALE_GRACE)) return;
      lastFiredAt = id;
      void claimFiredEvent(AZKAR_REMINDER_FIRED_KEY, id).then((owned) => {
        if (owned && !cancelled) onFireRef.current(event);
      });
    };

    const arm = () => {
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
        fire(event);
        timer = setTimeout(arm, 1_000);
      }, Math.max(0, remaining));
    };

    // Re-arm against the live clock on wake/refocus so the next reminder is
    // scheduled correctly after sleep — never replays one that already passed.
    const onWake = () => {
      if (document.visibilityState === "visible") arm();
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
