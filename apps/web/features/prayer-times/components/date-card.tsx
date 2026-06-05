"use client";

import { gregorianDate, hijriDate } from "@/features/prayer-times/lib/format";

export function DateCard({ date, locale }: { date: Date; locale: "ar" | "en" }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-5 text-center">
      <div className="font-display text-xl text-text">{gregorianDate(date, locale)}</div>
      <div className="mt-1.5 text-lg text-sun">{hijriDate(date, locale)}</div>
    </div>
  );
}
