"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { PrayerCountdown } from "@/features/prayer-times/components/prayer-countdown";
import { SunArc, type ArcDot } from "@/features/prayer-times/components/sun-arc";
import { formatClock, hijriDate } from "@/features/prayer-times/lib/format";
import { usePrayerSettings } from "@/features/prayer-times/hooks/use-prayer-settings";
import { ensurePrayerMonth, resolvePrayerDay } from "@/features/prayer-times/lib/aladhan";
import {
  getArcPosition,
  getNextPrayer,
  type PrayerDay,
  type PrayerKey,
} from "@repo/api/services/prayer-times";

// Day fraction (Fajr→Isha) for each instant — used to place arc dots. `labelFor`
// resolves the localized prayer name rendered above each point.
export function buildArcDots(
  day: PrayerDay,
  nextKey: PrayerKey | null,
  labelFor: (key: PrayerKey) => string,
): ArcDot[] {
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
      fraction: fajr ? Math.min(1, Math.max(0, (i.time!.getTime() - fajr.getTime()) / span)) : 0.5,
      isNext: i.key === nextKey,
      label: labelFor(i.key),
    }));
}

export function PrayerTimesWidget({ locale }: { locale: "ar" | "en" }) {
  const t = useTranslations("prayer");
  const { location, prefs } = usePrayerSettings();
  const [now, setNow] = useState<number>(() => Date.now());
  const [warm, setWarm] = useState(0);

  // Tick every second so the sun visibly glides along the arc as time passes.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Warm the Aladhan month cache so the shown times match the authoritative
  // minute the adhan fires on (parity with mobile); bump `warm` once resolved.
  useEffect(() => {
    let cancelled = false;
    void ensurePrayerMonth({
      lat: location.lat,
      lng: location.lng,
      method: prefs.method,
      madhab: prefs.madhab,
      date: new Date(),
    }).then(() => {
      if (!cancelled) setWarm((w) => w + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [location.lat, location.lng, prefs.method, prefs.madhab]);

  // Prayer instants only change with the calendar day, so recompute the day
  // per-minute (cheap) rather than every second; the sun position below reads
  // the live `now` so it still moves smoothly each second. Official Aladhan
  // times when cached, else the adhan-js fallback.
  const minute = Math.floor(now / 60_000);
  const day = useMemo(
    () =>
      resolvePrayerDay({
        lat: location.lat,
        lng: location.lng,
        date: new Date(minute * 60_000),
        method: prefs.method,
        madhab: prefs.madhab,
      }),
    // `warm` is an intentional trigger: it forces a recompute once the Aladhan
    // month cache resolves (it isn't read inside the memo, hence the disable).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location.lat, location.lng, prefs.method, prefs.madhab, minute, warm],
  );

  const nowDate = new Date(now);
  const next = getNextPrayer(day, nowDate);
  const dots = buildArcDots(day, next?.key ?? null, (k) => t(k));
  // Sun rides the arc sunrise→sunset; after sunset it becomes a moon that rides
  // the arc sunset→sunrise. One helper returns the active body's position.
  const arc = getArcPosition(
    (date) =>
      resolvePrayerDay({
        lat: location.lat,
        lng: location.lng,
        method: prefs.method,
        madhab: prefs.madhab,
        date,
      }),
    nowDate,
  );
  const isNight = arc.isNight;
  const sunFraction = arc.fraction;

  // Shrouq (sunrise) is shown for reference; it is not a prayer, so getNextPrayer
  // never marks it "next" and no adhan is scheduled for it.
  const rowKeys: PrayerKey[] = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

  return (
    <section
      aria-labelledby="prayer-widget-heading"
      className="mt-8 overflow-hidden rounded-xl border border-border bg-surface"
    >
      <h2 id="prayer-widget-heading" className="sr-only">
        {t("title")}
      </h2>

      <div className="px-6 pt-5">
        <div className="flex items-center justify-between">
          <Link
            href="/prayer-times"
            className="flex items-center gap-1.5 text-sm text-text hover:text-primary"
          >
            🕌 {location.label}
          </Link>
          <span className="text-xs text-sun">{hijriDate(new Date(now), locale)}</span>
        </div>
      </div>

      {/* full-bleed arc */}
      <div className="mt-1">
        <SunArc dots={dots} sunFraction={sunFraction} nextLabel={t("next")} isNight={isNight} onNightBand={arc.onNightBand} />
      </div>

      {next ? (
        <div className="mb-3">
          <PrayerCountdown nextKey={next.key} target={next.time} locale={locale} />
        </div>
      ) : null}

      <div className="flex gap-1.5 border-t border-border px-6 py-4">
        {rowKeys.map((key) => {
          const inst = day.instants.find((i) => i.key === key)!;
          const isNext = next?.key === key;
          return (
            <div
              key={key}
              className={`flex-1 rounded-md px-0.5 py-1 text-center ${isNext ? "bg-primary/10" : ""}`}
            >
              <div className={`text-2xs uppercase tracking-[0.05em] ${isNext ? "text-primary" : "text-text-2"}`}>
                {t(key)}
              </div>
              <div className={`mt-1 text-sm tabular-nums ${isNext ? "font-semibold text-sun" : "text-text"}`}>
                {formatClock(inst.time, locale)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
