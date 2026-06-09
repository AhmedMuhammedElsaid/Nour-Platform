// Prayer timetable — list of all 6 prayer times with clock formatting.

import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { formatClock } from "@repo/shared-core/prayer-times/format";
import type { PrayerDay, PrayerKey } from "@repo/shared-core/prayer-times/compute";
import { initialLocale } from "@/lib/i18n";

type Props = {
  day: PrayerDay;
  nextPrayerKey: PrayerKey | null;
};

const PRAYER_KEYS: PrayerKey[] = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

export function PrayerTimetable({ day, nextPrayerKey }: Props) {
  const { t } = useTranslation();
  const locale = initialLocale;

  return (
    <View className="gap-1">
      {PRAYER_KEYS.map((key) => {
        const time = day.instants.find((i) => i.key === key)?.time ?? null;
        const isNext = key === nextPrayerKey;
        return (
          <View
            key={key}
            className={`flex-row items-center justify-between rounded-lg px-4 py-3 ${
              isNext ? "bg-surface border border-primary" : "bg-surface"
            }`}
          >
            <Text
              variant={isNext ? "title" : "body"}
              className={isNext ? "text-primary" : ""}
            >
              {t(`prayer.${key}`)}
            </Text>
            <Text
              variant={isNext ? "title" : "muted"}
              className={`tabular-nums ${isNext ? "text-primary" : ""}`}
            >
              {formatClock(time, locale)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
