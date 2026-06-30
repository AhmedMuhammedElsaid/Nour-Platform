"use client";

import { useEffect, useRef } from "react";

import type { AdhanSettings } from "@repo/api/schemas/prayer-times";
import type { PrayerLocation, PrayerPreferences } from "@repo/api/schemas/prayer-times";

import { resolvePrayerDay } from "../lib/aladhan";
import {
  ADHAN_PLAY_GRACE_MS,
  type AdhanEvent,
  isWithinAdhanWindow,
  nextAdhanEvent,
} from "../lib/adhan-schedule";
import { ADHAN_FIRED_KEY, claimFiredEvent } from "../lib/fired-event-store";

// Recompute at least this often so clock drift / sleep / background throttling
// can't push the fire time out by more than one chunk; the last leg is armed to
// the exact remaining ms so it lands on the second.
const MAX_CHUNK = 5 * 60_000; // 5 min
const FINAL_WINDOW = 30_000; // last 30s: arm the precise timeout
// A precise timer paused during device sleep can resolve its captured event
// minutes late; the shared ±window gate (ADHAN_PLAY_GRACE_MS) drops any fire more
// than the grace from the prayer instant so a resumed timer can't play an adhan
// well after its time. The adhan plays ONLY when the live clock is within the
// window of the prayer instant — opening or refocusing the tab never replays a
// prayer that already passed.

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
    let cancelled = false;
    // Fast-path dedup within this closure; the durable dedup lives in
    // localStorage (claimFiredEvent) because this closure is recreated on any
    // settings/location change and other tabs/paths can't see it.
    let lastFiredAt: string | null = null;

    const fire = (event: AdhanEvent) => {
      // The hard "is it actually a prayer time now?" gate, shared with the SW
      // notification-click path so no route can ever sound the adhan outside the
      // prayer window. Blocks an invalid/wrong time (NaN) or a timer that resolved
      // off-schedule (e.g. resumed late after sleep) — opening the tab can never
      // trigger a spurious adhan.
      if (!isWithinAdhanWindow(event.time, new Date(), ADHAN_PLAY_GRACE_MS)) return;
      const id = event.time.toISOString();
      if (lastFiredAt === id) return;
      lastFiredAt = id;
      void claimFiredEvent(ADHAN_FIRED_KEY, id).then((owned) => {
        if (owned && !cancelled) onFireRef.current(event);
      });
    };

    const arm = () => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      const now = new Date();
      // Official Aladhan times when the month cache is warm (the controller
      // prefetches it), else the adhan-js fallback — so firing lands on the
      // authoritative minute, matching the mobile app.
      const day = resolvePrayerDay({
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
        fire(event);
        // Re-arm a second later so we don't refire the same instant.
        timer = setTimeout(arm, 1_000);
      }, Math.max(0, remaining));
    };

    // Returning to the tab (or waking the device) re-arms against the live clock
    // so the NEXT prayer is scheduled correctly after sleep/throttling. It never
    // plays a prayer that already passed — the adhan only sounds when its instant
    // arrives with the page open.
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
