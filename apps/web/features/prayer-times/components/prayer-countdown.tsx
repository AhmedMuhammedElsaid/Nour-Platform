"use client";

import { useTranslations } from "next-intl";

import { formatCountdownClock } from "@/features/prayer-times/lib/format";
import type { PrayerKey } from "@repo/api/services/prayer-times";

/**
 * `now` is owned by the parent (which already ticks one for the sun arc) rather
 * than seeded here: a local `useState(() => Date.now())` disagreed with the SSR
 * pass and tripped React's hydration text mismatch. It also means one interval
 * per widget instead of two.
 */
export function PrayerCountdown({
  nextKey,
  target,
  locale,
  now,
}: {
  nextKey: PrayerKey;
  target: Date;
  locale: "ar" | "en";
  now: number;
}) {
  const t = useTranslations("prayer");

  // Live MM:SS / HH:MM:SS clock, matching the extension + mobile.
  const countdown = formatCountdownClock(target.getTime() - now, locale);

  return (
    // Order: label → name → countdown. The RTL container auto-mirrors this for
    // Arabic (countdown ends up on the left, label on the right); English keeps
    // label on the left. No manual reversal — that would defeat the mirror.
    <div className="flex items-baseline justify-center gap-2.5">
      <span className="text-xs uppercase tracking-widest text-text-2">
        {t("next")}
      </span>
      <span className="font-display text-xl font-semibold text-text sm:text-2xl">
        {t(nextKey)}
      </span>
      <span className="font-display text-lg font-semibold tabular-nums text-sun">
        {countdown}
      </span>
    </div>
  );
}
