"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { DateCard } from "@/features/prayer-times/components/date-card";
import { LocationPicker } from "@/features/prayer-times/components/location-picker";
import { MethodSettings } from "@/features/prayer-times/components/method-settings";
import { PrayerCountdown } from "@/features/prayer-times/components/prayer-countdown";
import { PrayerTimetable } from "@/features/prayer-times/components/prayer-timetable";
import { SunArc } from "@/features/prayer-times/components/sun-arc";
import { buildArcDots } from "@/features/prayer-times/components/prayer-times-widget";
import { usePrayerSettings } from "@/features/prayer-times/hooks/use-prayer-settings";
import {
  computePrayerTimes,
  getDayProgress,
  getNextPrayer,
} from "@repo/api/services/prayer-times";

export function PrayerPage({ locale }: { locale: "ar" | "en" }) {
  const t = useTranslations("prayer");
  const { location, prefs, setLocation, setMethod, setMadhab } = usePrayerSettings();
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const day = useMemo(
    () =>
      computePrayerTimes({
        lat: location.lat,
        lng: location.lng,
        date: new Date(now),
        method: prefs.method,
        madhab: prefs.madhab,
      }),
    [location.lat, location.lng, prefs.method, prefs.madhab, now],
  );

  const nowDate = new Date(now);
  const next = getNextPrayer(day, nowDate);
  const dots = buildArcDots(day, next?.key ?? null);
  const sunFraction = getDayProgress(day, nowDate);

  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="font-display text-3xl font-bold text-text">{t("title")}</h1>
      <p className="mt-1 text-sm text-text-2">🕌 {location.label}</p>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface pt-2">
        <SunArc dots={dots} sunFraction={sunFraction} nextLabel={t("next")} />
        {next ? (
          <div className="pb-6">
            <PrayerCountdown nextKey={next.key} target={next.time} />
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1.3fr_0.9fr]">
        <PrayerTimetable instants={day.instants} nextKey={next?.key ?? null} locale={locale} />

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
            <h2 className="mb-3 font-display text-base text-text">{t("changeCity")}</h2>
            <LocationPicker locale={locale} onSelect={setLocation} />
          </div>
        </div>
      </div>
    </section>
  );
}
