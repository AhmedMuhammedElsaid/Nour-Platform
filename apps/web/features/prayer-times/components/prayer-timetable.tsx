"use client";

import { useTranslations } from "next-intl";

import { formatClock } from "@/features/prayer-times/lib/format";
import type { PrayerInstant, PrayerKey } from "@repo/api/services/prayer-times";

const ICON: Record<PrayerKey, string> = {
  fajr: "🌅",
  sunrise: "☀️",
  dhuhr: "🌞",
  asr: "🌇",
  maghrib: "🌆",
  isha: "🌙",
};

export function PrayerTimetable({
  instants,
  nextKey,
  locale,
}: {
  instants: PrayerInstant[];
  nextKey: PrayerKey | null;
  locale: "ar" | "en";
}) {
  const t = useTranslations("prayer");

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      {instants.map((inst) => {
        const isNext = inst.key === nextKey;
        return (
          <div
            key={inst.key}
            className={`flex items-center gap-3.5 border-b border-border px-4 py-3 last:border-b-0 ${
              isNext ? "bg-primary/10" : ""
            }`}
          >
            <span
              className={`flex size-8 items-center justify-center rounded-md ${
                isNext ? "bg-primary" : "bg-surface-2"
              }`}
              aria-hidden="true"
            >
              {ICON[inst.key]}
            </span>
            <div className="flex-1">
              <div className={`font-display text-base ${isNext ? "text-sun" : "text-text"}`}>
                {t(inst.key)}
              </div>
            </div>
            <div
              className={`font-display text-lg tabular-nums ${
                isNext ? "font-semibold text-sun" : "text-text"
              }`}
            >
              {formatClock(inst.time, locale)}
            </div>
            {isNext ? (
              <span className="ms-2 text-2xs uppercase tracking-[0.08em] text-primary">
                {t("next")}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
