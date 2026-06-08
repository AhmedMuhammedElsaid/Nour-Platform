"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { CITIES, nearestCity, type City } from "@/features/prayer-times/data/cities";
import type { PrayerLocation } from "@repo/api/schemas/prayer-times";

function cityToLocation(c: City, locale: "ar" | "en"): PrayerLocation {
  return { lat: c.lat, lng: c.lng, label: c[locale] };
}

// Treat two coordinates as the same place within ~10m so the active location
// isn't listed twice (pinned row + a search hit).
function sameSpot(a: PrayerLocation, b: PrayerLocation): boolean {
  return Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lng - b.lng) < 1e-4;
}

export function LocationPicker({
  locale,
  current,
  onSelect,
}: {
  locale: "ar" | "en";
  current: PrayerLocation;
  onSelect: (loc: PrayerLocation) => void;
}) {
  const t = useTranslations("prayer");
  const [query, setQuery] = useState("");
  const [geoError, setGeoError] = useState(false);
  const [locating, setLocating] = useState(false);
  const [justSet, setJustSet] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? CITIES.filter((c) => c.en.toLowerCase().includes(q) || c.ar.includes(query.trim()))
      : CITIES;
    // Drop the active location from the list — it's pinned at the top.
    return list
      .filter((c) => !sameSpot(cityToLocation(c, locale), current))
      .slice(0, 6);
  }, [query, locale, current]);

  function useMyLocation(): void {
    setGeoError(false);
    setJustSet(null);
    // Geolocation needs a secure context (https / localhost); on insecure
    // origins the API is absent entirely.
    if (!("geolocation" in navigator) || !window.isSecureContext) {
      setGeoError(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const near = nearestCity(pos.coords.latitude, pos.coords.longitude);
        // Persist the precise device coordinates, labelled by the nearest city.
        onSelect({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: near[locale],
        });
        setJustSet(near[locale]);
      },
      () => {
        // Fires on permission denial *and* timeout — without an explicit
        // timeout the prompt could hang indefinitely on some browsers.
        setLocating(false);
        setGeoError(true);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchCity")}
          className="flex-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          // Fixed width so swapping the label to "Locating…" doesn't reflow.
          className="inline-flex min-w-[7.5rem] items-center justify-center rounded-md border border-border px-3 py-2 text-sm text-sun hover:bg-surface-2 disabled:opacity-60"
        >
          {locating ? t("locating") : t("useMyLocation")}
        </button>
      </div>

      {/* Reserved status line — always present so toggling it never shifts the
          surrounding layout. */}
      <p className="min-h-4 text-xs text-text-2" role="status" aria-live="polite">
        {geoError
          ? t("locationDenied", { city: "Cairo" })
          : justSet
            ? t("locationSet", { city: justSet })
            : ""}
      </p>

      <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
        {/* Pinned: the active location, so the user always sees what's stored. */}
        <li>
          <button
            type="button"
            aria-current="true"
            onClick={() => onSelect(current)}
            className="flex w-full items-center justify-between bg-surface-2 px-3 py-2 text-start text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span>{current.label}</span>
            <span className="text-xs text-sun">✓ {t("currentLocation")}</span>
          </button>
        </li>

        {results.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => {
                onSelect(cityToLocation(c, locale));
                setJustSet(null);
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-start text-sm text-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>{c[locale]}</span>
              <span className="text-xs text-text-2">{c.country}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
