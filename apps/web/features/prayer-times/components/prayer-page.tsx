"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { DateCard } from "@/features/prayer-times/components/date-card";
import { LocationPicker } from "@/features/prayer-times/components/location-picker";
import { MethodSettings } from "@/features/prayer-times/components/method-settings";
import { PrayerCountdown } from "@/features/prayer-times/components/prayer-countdown";
import { PrayerTimetable } from "@/features/prayer-times/components/prayer-timetable";
import { SunArc } from "@/features/prayer-times/components/sun-arc";
import { AdhanSettings } from "@/features/prayer-times/components/adhan-settings";
import { AzkarReminderSettings } from "@/features/prayer-times/components/azkar-reminder-settings";
import { buildArcDots } from "@/features/prayer-times/components/prayer-times-widget";
import { usePrayerSettings } from "@/features/prayer-times/hooks/use-prayer-settings";
import { ensurePrayerMonth, resolvePrayerDay } from "@/features/prayer-times/lib/aladhan";
import {
  getArcPosition,
  getNextPrayer,
} from "@repo/api/services/prayer-times";

export function PrayerPage({ locale }: { locale: "ar" | "en" }) {
  const t = useTranslations("prayer");
  const { location, prefs, setLocation, setMethod, setMadhab } = usePrayerSettings();
  const [now, setNow] = useState<number>(() => Date.now());
  const [warm, setWarm] = useState(0);

  // Tick every second so the sun glides along the arc as time passes.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Warm the Aladhan month cache so the displayed timetable matches the
  // authoritative minute the adhan fires on (parity with mobile). Bump `warm`
  // when it resolves so the memo recomputes from the now-cached official times.
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

  // Recompute the day per-minute (prayer instants only change by calendar day);
  // the sun position reads live `now` so it still moves smoothly each second.
  // Official Aladhan times when cached, else the adhan-js fallback.
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

  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="font-display text-3xl font-bold text-text">{t("title")}</h1>
      <p className="mt-1 text-sm text-text-2">🕌 {location.label}</p>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface pt-2">
        <SunArc dots={dots} sunFraction={sunFraction} nextLabel={t("next")} isNight={isNight} onNightBand={arc.onNightBand} />
        {next ? (
          <div className="pb-6">
            <PrayerCountdown nextKey={next.key} target={next.time} />
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid items-start gap-6 md:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-6">
          <PrayerTimetable instants={day.instants} nextKey={next?.key ?? null} locale={locale} />
          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 font-display text-base text-text">{t("changeCity")}</h2>
            <LocationPicker locale={locale} current={location} onSelect={setLocation} />
          </div>
        </div>

        <div className="space-y-4">
          <DateCard date={new Date(now)} locale={locale} />
          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 font-display text-base text-text">{t("calculation")}</h2>
            <MethodSettings
              method={prefs.method}
              madhab={prefs.madhab}
              onMethodChange={setMethod}
              onMadhabChange={setMadhab}
            />
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 font-display text-base text-text">{t("adhan.title")}</h2>
            <AdhanSettings />
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 font-display text-base text-text">{t("azkar.title")}</h2>
            <AzkarReminderSettings />
          </div>
        </div>
      </div>
    </section>
  );
}
