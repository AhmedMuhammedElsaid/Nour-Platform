"use client";

import { useCallback, useEffect, useState } from "react";

import {
  type CalculationMethodId,
  type MadhabId,
  type PrayerLocation,
  type PrayerPreferences,
  DEFAULT_LOCATION,
  DEFAULT_MADHAB,
  DEFAULT_METHOD,
  calculationMethodSchema,
  madhabSchema,
  prayerLocationSchema,
} from "@repo/api/schemas/prayer-times";

import { nearestCity } from "@/features/prayer-times/data/cities";

const LOCATION_KEY = "nour.prayer.location";
const PREFS_KEY = "nour.prayer.prefs";
// Set once after the first-visit geolocation attempt so we never re-prompt on
// later loads (even if the user denied and we kept the Cairo default).
const ASKED_KEY = "nour.prayer.locationAsked";

function readLocation(): PrayerLocation {
  try {
    const raw = localStorage.getItem(LOCATION_KEY);
    if (!raw) return DEFAULT_LOCATION;
    const parsed = prayerLocationSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_LOCATION;
  } catch {
    return DEFAULT_LOCATION;
  }
}

function readPrefs(): PrayerPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { method: DEFAULT_METHOD, madhab: DEFAULT_MADHAB };
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const method = calculationMethodSchema.safeParse(obj.method);
    const madhab = madhabSchema.safeParse(obj.madhab);
    return {
      method: method.success ? method.data : DEFAULT_METHOD,
      madhab: madhab.success ? madhab.data : DEFAULT_MADHAB,
    };
  } catch {
    return { method: DEFAULT_METHOD, madhab: DEFAULT_MADHAB };
  }
}

// First-visit: ask the browser for the device location so prayer times are
// computed for where the user actually is, not the Cairo default (the root
// cause of "prayer times show Egypt time"). Runs at most once per browser;
// on denial/timeout we keep the default and the city picker stays available.
function autoDetectLocation(apply: (loc: PrayerLocation) => void): void {
  try {
    if (localStorage.getItem(ASKED_KEY)) return;
  } catch {
    return;
  }
  // getCurrentPosition needs a secure context (https/localhost).
  if (typeof window === "undefined" || !window.isSecureContext) return;
  if (!("geolocation" in navigator)) return;

  try {
    localStorage.setItem(ASKED_KEY, "1");
  } catch {
    /* ignore — worst case we re-ask next load */
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const city = nearestCity(pos.coords.latitude, pos.coords.longitude);
      const loc: PrayerLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        label: city.en,
        cityId: city.id,
      };
      apply(loc);
      try {
        localStorage.setItem(LOCATION_KEY, JSON.stringify(loc));
      } catch {
        /* keep in-memory state */
      }
    },
    () => {
      // Denied / unavailable / timeout — keep the default; the user can still
      // pick a city from the location picker.
    },
    { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 },
  );
}

export type PrayerSettings = {
  location: PrayerLocation;
  prefs: PrayerPreferences;
  hydrated: boolean;
  setLocation: (loc: PrayerLocation) => void;
  setMethod: (method: CalculationMethodId) => void;
  setMadhab: (madhab: MadhabId) => void;
};

export function usePrayerSettings(): PrayerSettings {
  // Server + first client render use defaults to avoid hydration mismatch.
  const [location, setLocationState] = useState<PrayerLocation>(DEFAULT_LOCATION);
  const [prefs, setPrefs] = useState<PrayerPreferences>({
    method: DEFAULT_METHOD,
    madhab: DEFAULT_MADHAB,
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Did the user ever store a location? (null = genuine first visit, so the
    // prayer times would otherwise silently use the Cairo default.)
    let hasStored = false;
    try {
      hasStored = localStorage.getItem(LOCATION_KEY) != null;
    } catch {
      /* storage unavailable — treat as not stored */
    }

    setLocationState(readLocation());
    setPrefs(readPrefs());
    setHydrated(true);

    if (!hasStored) autoDetectLocation(setLocationState);
  }, []);

  const setLocation = useCallback((loc: PrayerLocation) => {
    setLocationState(loc);
    try {
      localStorage.setItem(LOCATION_KEY, JSON.stringify(loc));
    } catch {
      /* storage unavailable — keep in-memory state */
    }
  }, []);

  const persistPrefs = useCallback((next: PrayerPreferences) => {
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const setMethod = useCallback(
    (method: CalculationMethodId) => persistPrefs({ ...readPrefs(), method }),
    [persistPrefs],
  );
  const setMadhab = useCallback(
    (madhab: MadhabId) => persistPrefs({ ...readPrefs(), madhab }),
    [persistPrefs],
  );

  return { location, prefs, hydrated, setLocation, setMethod, setMadhab };
}
