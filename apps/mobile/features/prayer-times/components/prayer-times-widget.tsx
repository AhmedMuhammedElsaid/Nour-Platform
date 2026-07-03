// Home-screen prayer widget — mirrors apps/web/features/prayer-times/components/
// prayer-times-widget.tsx. Live sun/moon arc + countdown + a five-prayer row,
// tapping anywhere opens the full /prayer-times screen. Self-contained: reads
// device settings, ticks every second, and computes the arc via the same
// isomorphic getArcPosition the web widget uses.

import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { Text } from "@/components/ui/text";
import { SunArc } from "@/features/prayer-times/components/sun-arc";
import { buildArcDots } from "@/features/prayer-times/lib/arc-dots";
import { usePrayerSettings } from "@/features/prayer-times/hooks/use-prayer-settings";
import { cityLabel } from "@/features/prayer-times/data/cities";
import { initialLocale } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import {
  computePrayerTimes,
  getArcPosition,
  getNextPrayer,
  type NextPrayer,
  type PrayerKey,
} from "@repo/shared-core/prayer-times/compute";
import { usePrayerDay } from "@/features/prayer-times/hooks/use-prayer-day";
import {
  formatClock,
  formatCountdownClock,
  hijriDate,
} from "@repo/shared-core/prayer-times/format";

// Shrouq (sunrise) is shown for reference but is NOT a prayer — getUpcomingPrayer
// never returns it (COUNTDOWN_ORDER excludes it), so it is never the "next"
// highlight, and the azan scheduler skips it (no adhan).
const ROW_KEYS: PrayerKey[] = [
  "fajr",
  "sunrise",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
];

export function PrayerTimesWidget() {
  const { t } = useTranslation();
  const locale = initialLocale;
  const router = useRouter();
  const { theme } = useTheme();
  const { location, prefs, hydrated } = usePrayerSettings();
  const [now, setNow] = useState(() => new Date());

  // Tick every second so the body glides along the arc and the countdown updates
  // — but ONLY while Home is focused. The screen stays mounted in the stack when
  // you navigate away, so an unconditional interval would keep recomputing prayer
  // times every second on every other screen, making the whole app feel laggy.
  // useFocusEffect starts the interval on focus and clears it on blur.
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      const id = setInterval(() => setNow(new Date()), 1000);
      return () => clearInterval(id);
    }, []),
  );

  const arcInput = {
    lat: location.lat,
    lng: location.lng,
    method: prefs.method,
    madhab: prefs.madhab,
  };

  // Aladhan-sourced day (cached per month, falls back to local adhan-js).
  const day = usePrayerDay(location.lat, location.lng, prefs.method, prefs.madhab, now);

  // Derive the upcoming prayer from the Aladhan day so the displayed time and
  // the notification fire at the same authoritative minute. After Isha we fall
  // back to local computation for tomorrow's Fajr (display only; the scheduler
  // fetches tomorrow from Aladhan separately).
  const DAY_MS = 86_400_000;
  const upcoming = useMemo((): NextPrayer => {
    const next = getNextPrayer(day, now);
    if (next) return next;
    const tom = computePrayerTimes({
      ...arcInput,
      date: new Date(now.getTime() + DAY_MS),
    });
    const fajr = tom.instants.find((i) => i.key === "fajr")?.time;
    const fallback = new Date(now.getTime() + DAY_MS);
    const t = fajr ?? fallback;
    return { key: "fajr", time: t, msUntil: t.getTime() - now.getTime() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, now.toDateString(), Math.floor(now.getTime() / 60_000)]);

  // Source the moon from the SAME Aladhan day the dots use (not a second adhan-js
  // computation) so it hands off on the exact Fajr dot the adhan fired on; adjacent
  // days (night-band sweep only) fall back to local computation.
  const arc = getArcPosition(
    (date) =>
      date.toDateString() === now.toDateString()
        ? day
        : computePrayerTimes({ ...arcInput, date }),
    now,
  );
  const dots = buildArcDots(day, upcoming.key, (k) => t(`prayer.${k}`));
  const countdown = formatCountdownClock(
    Math.max(0, upcoming.time.getTime() - now.getTime()),
    locale,
  );

  if (!hydrated) return null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push("/prayer-times")}
      className="overflow-hidden rounded-xl border border-border bg-surface"
    >
      {/* location + hijri date */}
      <View className="flex-row items-center justify-between px-4 pt-3">
        <Text variant="body" className="text-sm">
          🕌 {cityLabel(location, initialLocale)}
        </Text>
        <Text variant="muted" className="text-xs text-sun">
          {hijriDate(now, locale)}
        </Text>
      </View>

      {/* full-bleed arc */}
      <View className="mt-1">
        <SunArc dots={dots} fraction={arc.fraction} isNight={arc.isNight} onNightBand={arc.onNightBand} theme={theme} showLabels />
      </View>

      {/* next-prayer countdown — one horizontal row mirroring the web
          PrayerCountdown. DOM order is label → name → countdown; because Arabic
          runs under I18nManager.forceRTL the row auto-mirrors (countdown ends on
          the left, label on the right), while English keeps label → name →
          countdown. Never reverse manually — that would defeat the mirror. */}
      <View className="flex-row items-baseline justify-center gap-2.5 px-3 pb-3">
        <Text variant="muted" className="text-xs uppercase tracking-[1px]">
          {t("prayer.next")}
        </Text>
        <Text variant="display" className="text-xl">
          {t(`prayer.${upcoming.key}`)}
        </Text>
        <Text
          variant="body"
          className="text-base font-semibold text-sun"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {countdown}
        </Text>
      </View>

      {/* five-prayer row */}
      <View className="flex-row gap-1 border-t border-border px-3 py-3">
        {ROW_KEYS.map((key) => {
          const inst = day.instants.find((i) => i.key === key);
          const isNext = upcoming.key === key;
          return (
            <View
              key={key}
              className={`flex-1 rounded-md px-0.5 py-1 ${isNext ? "bg-surface-2" : ""}`}
            >
              <Text
                variant="muted"
                className={`text-center text-xs uppercase ${isNext ? "text-primary" : ""}`}
              >
                {t(`prayer.${key}`)}
              </Text>
              <Text
                variant="body"
                className={`mt-0.5 text-center text-xs ${isNext ? "text-sun" : ""}`}
              >
                {formatClock(inst?.time ?? null, locale)}
              </Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}
