import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import {
  KAHF_SURAH,
  isKahfIconWindow,
} from "@repo/shared-core/prayer-times/schedule";
import { localKeyForDate } from "@repo/shared-core/prayer-times/aladhan";

import { Text } from "@/components/ui/text";
import { getKahfDismissedDate, setKahfDismissedDate } from "@/lib/device-local";

// Friday Surah Al-Kahf home card — visible Friday 12:00 → midnight unless
// dismissed for the day (`nour.kahf.dismissed`, cross-surface contract with
// the extension). Tapping through also dismisses (the card's job is done once
// the reader opens); the corner X dismisses in place. 60s clock so it appears
// at 12:00 while Home is already open. Two SIBLING Pressables (open/dismiss),
// never nested — codebase convention (see dhikr-of-the-day-card.tsx).

// rn-svg stroke can't take a NativeWind class — literal gold matches the
// station-card/mini-player convention.
const GOLD = "#c8a050";

function QuranGlyph() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 5.5C10.5 4 8 3.5 5.5 3.5c-.8 0-1.5.1-2 .2v14.6c.5-.1 1.2-.2 2-.2 2.5 0 5 .5 6.5 2 1.5-1.5 4-2 6.5-2 .8 0 1.5.1 2 .2V3.7c-.5-.1-1.2-.2-2-.2-2.5 0-5 .5-6.5 2Z" />
      <Path d="M12 5.5v14.6" />
    </Svg>
  );
}

export function KahfFridayCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  // null = AsyncStorage not hydrated yet; "" = never dismissed.
  const [dismissedOn, setDismissedOn] = useState<string | null>(null);

  useEffect(() => {
    void getKahfDismissedDate().then((d) => setDismissedOn(d ?? ""));
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const today = localKeyForDate(now);
  const dismiss = useCallback(() => {
    setDismissedOn(today);
    void setKahfDismissedDate(today);
  }, [today]);

  if (dismissedOn === null) return null;
  if (!isKahfIconWindow(now) || dismissedOn === today) return null;

  return (
    <View className="relative mt-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("home.kahfBody")}
        onPress={() => {
          dismiss();
          router.push(`/quran/${KAHF_SURAH}`);
        }}
        className="flex-row items-center gap-4 rounded-2xl border border-primary/40 bg-surface p-4"
      >
        <View className="size-11 items-center justify-center rounded-full bg-surface-2">
          <QuranGlyph />
        </View>
        <View className="flex-1">
          <Text variant="title">{t("home.kahfTitle")}</Text>
          <Text variant="muted" className="mt-0.5 text-sm">
            {t("home.kahfBody")}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("home.kahfDismiss")}
        onPress={dismiss}
        hitSlop={8}
        className="absolute -top-2 -end-2 size-6 items-center justify-center rounded-full border border-border bg-surface-2"
      >
        <Text variant="muted" className="text-xs leading-none">
          ✕
        </Text>
      </Pressable>
    </View>
  );
}
