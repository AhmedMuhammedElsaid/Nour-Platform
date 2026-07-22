import { useMemo, useState } from "react";

import {
  ADHAN_PRAYER_KEYS,
  CALCULATION_METHOD_IDS,
  type AdhanPrayerKey,
  type CalculationMethodId,
  type MadhabId,
} from "@repo/shared-core/schemas/prayer-times";
import type { PrayerDay, PrayerKey } from "@repo/shared-core/prayer-times/compute";
import {
  formatClock,
  formatCountdownClock,
  gregorianDate,
  hijriDate,
} from "@repo/shared-core/prayer-times/format";

import { usePrayerTimes } from "../lib/use-prayer-times";
import {
  useAdhanSettings,
  useAzkarSettings,
  useLocation,
  usePrefs,
} from "../options/use-settings";
import { useI18n } from "../lib/i18n";
import { SunArc, type ArcDot } from "./sun-arc";
import { Skeleton } from "./skeleton";

import { CITIES } from "../lib/cities";

const PRAYER_ICON: Record<PrayerKey, string> = {
  fajr: "🌅",
  sunrise: "☀️",
  dhuhr: "🌞",
  asr: "🌇",
  maghrib: "🌆",
  isha: "🌙",
};

function buildArcDots(day: PrayerDay, nextKey: PrayerKey | null, t: (k: string) => string): ArcDot[] {
  const fajr = day.instants.find((i) => i.key === "fajr")?.time ?? null;
  const isha = day.instants.find((i) => i.key === "isha")?.time ?? null;
  const span =
    fajr && isha && isha.getTime() > fajr.getTime()
      ? isha.getTime() - fajr.getTime()
      : 1;
  return day.instants
    .filter((i) => i.time != null)
    .map((i) => ({
      key: i.key,
      fraction: fajr
        ? Math.min(1, Math.max(0, (i.time!.getTime() - fajr.getTime()) / span))
        : 0.5,
      isNext: i.key === nextKey,
      label: t(`prayer.${i.key}`),
    }));
}

export function PrayerPage() {
  const { t, locale } = useI18n();
  const times = usePrayerTimes();
  const { location, setLocation } = useLocation();
  const { prefs, setPrefs } = usePrefs();
  const { adhan, setAdhan } = useAdhanSettings();
  const { azkar, setAzkar } = useAzkarSettings();
  const [cityQ, setCityQ] = useState("");
  const [locating, setLocating] = useState(false);

  const filteredCities = useMemo(() => {
    const q = cityQ.trim().toLowerCase();
    if (!q) return CITIES.slice(0, 8);
    return CITIES.filter(
      (c) => c.en.toLowerCase().includes(q) || c.ar.includes(cityQ.trim()),
    ).slice(0, 8);
  }, [cityQ]);

  function useMyLocation(): void {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        void setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: t("prayer.myLocation"),
        });
      },
      () => setLocating(false),
    );
  }

  if (!times || !prefs || !adhan || !azkar || !location) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8" aria-hidden="true">
        <div className="space-y-1">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-8 w-48" />
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3.5 border-b border-border px-4 py-3 last:border-b-0"
            >
              <Skeleton className="size-8" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { today, upcoming, arcPos, now } = times;
  const arcDots = buildArcDots(today, upcoming.key, t);
  const displayLocale = locale === "en" ? "en" : "ar";
  const countdownStr = formatCountdownClock(upcoming.msUntil, displayLocale);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-text">{t("prayer.title")}</h1>
        <p className="mt-0.5 text-sm text-text-2">🕌 {location.label}</p>
      </div>

      {/* Sun arc + countdown */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface pt-2">
        <SunArc
          dots={arcDots}
          sunFraction={arcPos.fraction}
          nextLabel={t("prayer.next")}
          isNight={arcPos.isNight}
          onNightBand={arcPos.onNightBand}
        />
        <div className="pb-5 text-center">
          <p className="text-xs uppercase tracking-[0.08em] text-text-2">
            {t(`prayer.${upcoming.key}`)} · {t("prayer.next")}
          </p>
          <p className="font-display text-3xl tabular-nums text-sun">
            {countdownStr}
          </p>
        </div>
      </div>

      {/* Date card */}
      <div className="rounded-xl border border-border bg-surface px-4 py-4 text-center">
        <div className="font-display text-lg text-text">{gregorianDate(now, displayLocale)}</div>
        <div className="mt-1 text-base text-sun">{hijriDate(now, displayLocale)}</div>
      </div>

      {/* Timetable */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {today.instants.map((inst) => {
          const isNext = inst.key === upcoming.key;
          return (
            <div
              key={inst.key}
              className={`flex items-center gap-3.5 border-b border-border px-4 py-3 last:border-b-0 ${isNext ? "bg-primary/10" : ""}`}
            >
              <span
                className={`flex size-8 items-center justify-center rounded-md text-base ${isNext ? "bg-primary" : "bg-surface-2"}`}
                aria-hidden="true"
              >
                {PRAYER_ICON[inst.key]}
              </span>
              <div className={`flex-1 font-display text-base ${isNext ? "text-sun" : "text-text"}`}>
                {t(`prayer.${inst.key}`)}
              </div>
              {isNext ? (
                <span className="text-2xs uppercase tracking-[0.08em] text-primary">
                  {t("prayer.next")}
                </span>
              ) : null}
              <div className={`font-display text-lg tabular-nums ${isNext ? "font-semibold text-sun" : "text-text"}`}>
                {inst.time ? formatClock(inst.time, displayLocale) : "—"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Location picker */}
      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <h2 className="font-display text-base text-text">{t("prayer.changeCity")}</h2>
        <input
          type="search"
          value={cityQ}
          onChange={(e) => setCityQ(e.target.value)}
          placeholder="Cairo, London…"
          className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          dir="auto"
        />
        <button
          type="button"
          disabled={locating}
          onClick={useMyLocation}
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text hover:bg-surface disabled:opacity-50"
        >
          📍 {t("prayer.myLocation")}
        </button>
        <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
          {filteredCities.map((c) => (
            <li key={c.en}>
              <button
                type="button"
                onClick={() => {
                  void setLocation({ lat: c.lat, lng: c.lng, label: locale === "en" ? c.en : c.ar, cityId: c.id });
                  setCityQ("");
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-start text-sm text-text hover:bg-primary/5"
              >
                <span>{c.en}</span>
                <span dir="rtl" className="text-text-2">{c.ar}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Calculation settings */}
      <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
        <h2 className="font-display text-base text-text">{t("prayer.calculation")}</h2>
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-[0.06em] text-text-2">
            {t("prayer.method")}
          </span>
          <select
            value={prefs.method}
            onChange={(e) => void setPrefs({ ...prefs, method: e.target.value as CalculationMethodId })}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text"
          >
            {CALCULATION_METHOD_IDS.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-[0.06em] text-text-2">
            {t("prayer.madhab")}
          </span>
          <select
            value={prefs.madhab}
            onChange={(e) => void setPrefs({ ...prefs, madhab: e.target.value as MadhabId })}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text"
          >
            <option value="standard">{t("prayer.madhabStandard")}</option>
            <option value="hanafi">{t("prayer.madhabHanafi")}</option>
          </select>
        </label>
      </div>

      {/* Adhan settings */}
      <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
        <h2 className="font-display text-base text-text">{t("prayer.adhan.title")}</h2>
        <label className="flex items-center justify-between gap-3 text-sm text-text">
          {t("prayer.adhan.enable")}
          <input
            type="checkbox"
            checked={adhan.enabled}
            onChange={(e) => void setAdhan({ ...adhan, enabled: e.target.checked })}
            className="size-4 accent-[var(--color-primary)]"
          />
        </label>
        {adhan.enabled ? (
          <>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-xs uppercase tracking-[0.06em] text-text-2">
                {t("prayer.adhan.perPrayer")}
              </legend>
              {ADHAN_PRAYER_KEYS.map((key: AdhanPrayerKey) => (
                <label key={key} className="flex items-center justify-between gap-3 text-sm text-text">
                  {t(`prayer.${key}`)}
                  <input
                    type="checkbox"
                    checked={adhan.perPrayer[key]}
                    onChange={(e) =>
                      void setAdhan({ ...adhan, perPrayer: { ...adhan.perPrayer, [key]: e.target.checked } })
                    }
                    className="size-4 accent-[var(--color-primary)]"
                  />
                </label>
              ))}
            </fieldset>
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-[0.06em] text-text-2">
                {t("prayer.adhan.volume")}
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={adhan.volume}
                onChange={(e) => void setAdhan({ ...adhan, volume: Number(e.target.value) })}
                className="w-full accent-[var(--color-primary)]"
              />
            </label>
          </>
        ) : null}
      </div>

      {/* Azkar reminder */}
      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <h2 className="font-display text-base text-text">{t("prayer.azkar.title")}</h2>
        <label className="flex items-center justify-between gap-3 text-sm text-text">
          {t("prayer.azkar.enable")}
          <input
            type="checkbox"
            checked={azkar.enabled}
            onChange={(e) => void setAzkar({ ...azkar, enabled: e.target.checked })}
            className="size-4 accent-[var(--color-primary)]"
          />
        </label>
      </div>
    </div>
  );
}
