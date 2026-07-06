// Isolated ticking countdown — mirrors apps/web/features/prayer-times/components/
// prayer-countdown.tsx. Owns its OWN 1s interval + local `now` state so only this
// small leaf re-renders every second, not the whole screen/widget it's mounted in.
// The parent only needs to recompute `nextKey`/`target` when the actual upcoming
// prayer changes (roughly once a minute), never every second — and since the
// countdown is derived fresh here on every tick (never a value baked in at the
// parent's render time), it can't go stale between parent re-renders either.

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";

import { Text } from "@/components/ui/text";
import { formatCountdownClock } from "@repo/shared-core/prayer-times/format";
import type { Locale } from "@repo/shared-core/schemas/locale";
import type { PrayerKey } from "@repo/shared-core/prayer-times/compute";

export function PrayerCountdown({
  nextKey,
  target,
  locale,
  size = "lg",
}: {
  nextKey: PrayerKey;
  target: Date;
  locale: Locale;
  // "lg" = full prayer-times screen sizing; "sm" = compact Home widget sizing.
  size?: "sm" | "lg";
}) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      const id = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(id);
    }, []),
  );

  const countdown = formatCountdownClock(Math.max(0, target.getTime() - now), locale);
  const nameSize = size === "lg" ? "text-2xl" : "text-xl";
  const clockSize = size === "lg" ? "text-xl" : "text-base";

  return (
    // Order: label → name → countdown. The RTL container auto-mirrors this for
    // Arabic (countdown ends up on the left, label on the right); English keeps
    // label → name → countdown. No manual reversal — that would defeat the mirror.
    <View className="flex-row items-baseline justify-center gap-2.5">
      <Text variant="muted" className="text-xs uppercase tracking-[1px]">
        {t("prayer.next")}
      </Text>
      <Text variant="display" className={nameSize}>
        {t(`prayer.${nextKey}`)}
      </Text>
      <Text
        variant="body"
        className={`${clockSize} font-semibold text-sun`}
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {countdown}
      </Text>
    </View>
  );
}
