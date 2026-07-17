import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";

import type { Azkar } from "@repo/shared-core/schemas/azkar";
import { pickDhikrOfTheDay } from "@repo/shared-core/adhkar/dhikr-of-the-day";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { initialLocale } from "@/lib/i18n";
import { adhkarListQuery } from "@/lib/queries";
import {
  getAzkarProgress,
  recordDhikrCount,
  resetAzkarProgressIfNewDay,
} from "@/lib/device-local";

// Home "Dhikr of the day" card — mirrors apps/web/features/adhkar/components/
// dhikr-of-the-day-card.tsx. Self-fetches like AdhkarPreviewShelf (no props).
//
// Two SIBLING Pressables (navigate-text / counter), never nested — same
// non-overlapping-controls convention as StationCard
// (features/radio/components/station-card.tsx: a corner favorite Pressable +
// a separate play Pressable, not one wrapping the other). RN doesn't forbid
// nested Pressables the way HTML forbids a <button> inside an <a>, but this
// codebase's established pattern is still separate sibling controls.
//
// Counting writes to the SAME nour.adhkar.progress AsyncStorage key the full
// Adhkar reader (app/adhkar/[slug].tsx) uses, keyed by the real
// (setId, itemIndex) pair, so progress is shared with the full reader.
export function DhikrOfTheDayCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = initialLocale;
  const { data } = useQuery(adhkarListQuery());
  const sets = useMemo(() => (data ?? []) as Azkar[], [data]);

  const picked = useMemo(() => pickDhikrOfTheDay(sets), [sets]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (picked == null) return;
    let cancelled = false;
    void resetAzkarProgressIfNewDay()
      .then(() => getAzkarProgress())
      .then((progress) => {
        if (cancelled) return;
        setCount(progress.sets[picked.setId]?.[String(picked.itemIndex)] ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [picked]);

  if (picked == null) return null;

  const { item, setId, itemIndex } = picked;
  const isDone = count >= item.repeat;
  const virtue =
    locale === "ar" ? (item.virtue?.ar ?? item.virtue?.en) : (item.virtue?.en ?? item.virtue?.ar);
  const parentSet = sets.find((s) => s.id === setId);
  const display = parentSet ? (parentSet[locale] ?? parentSet.ar) : null;

  const tap = () => {
    if (isDone) return;
    const next = count + 1;
    void recordDhikrCount(setId, itemIndex, next);
    setCount(next);
  };

  return (
    <View className="mt-8 gap-3">
      <Text variant="label">{t("home.dhikrOfTheDay")}</Text>

      <View className="items-center gap-3 rounded-2xl border border-border bg-surface p-6">
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push(display ? `/adhkar/${encodeURIComponent(display.slug)}` : "/adhkar")
          }
          className="w-full items-center gap-2"
        >
          <Text variant="display" className="text-center text-xl leading-relaxed">
            {item.ar}
          </Text>
          {item.en ? (
            <Text variant="muted" className="text-center">
              {item.en}
            </Text>
          ) : null}
          {virtue ? (
            <Text variant="muted" className="text-center text-xs">
              {virtue}
            </Text>
          ) : null}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("adhkar.countLabel")}
          disabled={isDone}
          onPress={tap}
          className={cn(
            "size-14 items-center justify-center rounded-full border-2 border-primary bg-surface-2",
            isDone && "opacity-50",
          )}
        >
          {isDone ? (
            <Text accessibilityLabel={t("adhkar.completed")} className="text-lg text-primary">
              ✓
            </Text>
          ) : (
            <>
              <Text className="text-base font-bold tabular-nums text-text">{count}</Text>
              <Text variant="muted" className="text-xs">
                / {item.repeat}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
