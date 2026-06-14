// Home-screen prayer widget — mirrors apps/web/features/prayer-times/components/
// prayer-times-widget.tsx. Live sun/moon arc + countdown + a five-prayer row,
// tapping anywhere opens the full /prayer-times screen. Self-contained: reads
// device settings, ticks every second, and computes the arc via the same
// isomorphic getArcPosition the web widget uses.

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";

import { Text } from "@/components/ui/text";
import { SunArc } from "@/features/prayer-times/components/sun-arc";
import { buildArcDots } from "@/features/prayer-times/lib/arc-dots";
import { usePrayerSettings } from "@/features/prayer-times/hooks/use-prayer-settings";
import { initialLocale } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import {
  computePrayerTimes,
  getArcPosition,
  getUpcomingPrayer,
  type PrayerKey,
} from "@repo/shared-core/prayer-times/compute";
import {
  formatClock,
  formatCountdown,
  hijriDate,
} from "@repo/shared-core/prayer-times/format";

const ROW_KEYS: Exclude<PrayerKey, "sunrise">[] = [
  "fajr",
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

  // Tick every second so the body visibly glides along the arc and the
  // countdown updates.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const arcInput = {
    lat: location.lat,
    lng: location.lng,
    method: prefs.method,
    madhab: prefs.madhab,
  };

  // Prayer instants only change at the day boundary; recompute per calendar day.
  const day = useMemo(
    () => computePrayerTimes({ ...arcInput, date: now }),
    // eslint deps intentionally omit arcInput object identity; primitives below.
    [location.lat, location.lng, prefs.method, prefs.madhab, now.toDateString()],
  );
  const upcoming = useMemo(
    () => getUpcomingPrayer(arcInput, now),
    [location.lat, location.lng, prefs.method, prefs.madhab, now],
  );

  const arc = getArcPosition(arcInput, now);
  const dots = buildArcDots(day, upcoming.key);
  const countdown = formatCountdown(upcoming.msUntil);

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
          🕌 {location.label}
        </Text>
        <Text variant="muted" className="text-xs text-sun">
          {hijriDate(now, locale)}
        </Text>
      </View>

      {/* full-bleed arc */}
      <View className="mt-1">
        <SunArc dots={dots} fraction={arc.fraction} isNight={arc.isNight} theme={theme} />
      </View>

      {/* next-prayer countdown */}
      <View className="items-center pb-3">
        <Text variant="muted" className="text-xs">
          {t("prayer.next")}
        </Text>
        <Text variant="display" className="text-xl text-primary">
          {t(`prayer.${upcoming.key}`)}
        </Text>
        <Text variant="muted" className="text-xs">
          {countdown.h > 0
            ? t("prayer.countdown", { h: countdown.h, m: countdown.m })
            : `${countdown.m}m`}
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
