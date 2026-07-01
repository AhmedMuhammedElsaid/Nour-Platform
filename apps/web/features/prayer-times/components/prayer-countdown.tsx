"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { formatCountdownClock } from "@/features/prayer-times/lib/format";
import type { PrayerKey } from "@repo/api/services/prayer-times";

export function PrayerCountdown({
  nextKey,
  target,
  locale,
}: {
  nextKey: PrayerKey;
  target: Date;
  locale: "ar" | "en";
}) {
  const t = useTranslations("prayer");
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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
