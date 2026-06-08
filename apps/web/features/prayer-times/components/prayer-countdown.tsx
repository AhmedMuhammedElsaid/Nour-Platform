"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { formatCountdown } from "@/features/prayer-times/lib/format";
import type { PrayerKey } from "@repo/api/services/prayer-times";

export function PrayerCountdown({
  nextKey,
  target,
}: {
  nextKey: PrayerKey;
  target: Date;
}) {
  const t = useTranslations("prayer");
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { h, m } = formatCountdown(target.getTime() - now);

  return (
    <div className="flex items-baseline justify-center gap-2.5">
      <span className="text-xs uppercase tracking-widest text-text-2">
        {t("next")}
      </span>
      <span className="font-display text-xl font-semibold text-text sm:text-2xl">
        {t(nextKey)}
      </span>
      <span className="font-display text-lg font-semibold text-sun">
        {t("countdown", { h, m })}
      </span>
    </div>
  );
}
