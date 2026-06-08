"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { CITIES, nearestCity, type City } from "@/features/prayer-times/data/cities";
import type { PrayerLocation } from "@repo/api/schemas/prayer-times";

function cityToLocation(c: City, locale: "ar" | "en"): PrayerLocation {
  return { lat: c.lat, lng: c.lng, label: c[locale] };
}

export function LocationPicker({
  locale,
  onSelect,
}: {
  locale: "ar" | "en";
  onSelect: (loc: PrayerLocation) => void;
}) {
  const t = useTranslations("prayer");
  const [query, setQuery] = useState("");
  const [geoError, setGeoError] = useState(false);
  const [locating, setLocating] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CITIES.slice(0, 6);
    return CITIES.filter(
      (c) => c.en.toLowerCase().includes(q) || c.ar.includes(query.trim()),
    ).slice(0, 8);
  }, [query]);

  function useMyLocation(): void {
    setGeoError(false);
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
        onSelect({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: near[locale],
        });
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
          className="whitespace-nowrap rounded-md border border-border px-3 py-2 text-sm text-sun hover:bg-surface-2 disabled:opacity-60"
        >
          {locating ? t("locating") : t("useMyLocation")}
        </button>
      </div>

      {geoError ? (
        <p className="text-xs text-text-2">{t("locationDenied", { city: "Cairo" })}</p>
      ) : null}

      <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
        {results.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(cityToLocation(c, locale))}
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
