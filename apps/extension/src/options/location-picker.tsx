import { useMemo, useState } from "react";

import type { PrayerLocation } from "@repo/shared-core/schemas/prayer-times";

import { CITIES } from "../lib/cities";

function sameSpot(a: PrayerLocation, b: PrayerLocation): boolean {
  return Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lng - b.lng) < 1e-4;
}

export function LocationPicker({
  current,
  onSelect,
}: {
  current: PrayerLocation;
  onSelect: (loc: PrayerLocation) => void;
}) {
  const [query, setQuery] = useState("");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [justSet, setJustSet] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? CITIES.filter(
          (c) => c.en.toLowerCase().includes(q) || c.ar.includes(query.trim()),
        )
      : CITIES;
    return list.filter((c) => !sameSpot({ lat: c.lat, lng: c.lng, label: c.en }, current)).slice(0, 6);
  }, [query, current]);

  function useMyLocation() {
    setGeoError(null);
    setJustSet(null);
    if (!("geolocation" in navigator)) {
      setGeoError("Geolocation not supported in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const loc: PrayerLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: "My location",
        };
        onSelect(loc);
        setJustSet("My location");
      },
      (err) => {
        setLocating(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Location access denied. Enable it in Chrome settings."
            : err.code === err.TIMEOUT
              ? "Location request timed out."
              : "Location unavailable.",
        );
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 },
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search city…"
          className="flex-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="inline-flex min-w-[8rem] items-center justify-center rounded-md border border-border px-3 py-2 text-sm text-sun hover:bg-surface-2 disabled:opacity-60"
        >
          {locating ? "Locating…" : "Use my location"}
        </button>
      </div>

      <p className="min-h-4 text-xs text-text-2" role="status" aria-live="polite">
        {geoError ?? (justSet ? `Location set: ${justSet}` : "")}
      </p>

      <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
        <li>
          <button
            type="button"
            aria-current="true"
            onClick={() => onSelect(current)}
            className="flex w-full items-center justify-between bg-surface-2 px-3 py-2 text-start text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span>{current.label}</span>
            <span className="text-xs text-sun">✓ current</span>
          </button>
        </li>
        {results.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => {
                onSelect({ lat: c.lat, lng: c.lng, label: c.en });
                setJustSet(null);
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-start text-sm text-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>{c.en}</span>
              <span className="text-xs text-text-2">{c.country}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
