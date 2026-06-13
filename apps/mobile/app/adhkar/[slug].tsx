import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { FlatList, Pressable, View } from "react-native";
import type { DhikrItem } from "@repo/shared-core/schemas/azkar";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { initialLocale } from "@/lib/i18n";
import { adhkarDetailQuery } from "@/lib/queries";
import {
  getAzkarProgress,
  recordDhikrCount,
  resetAzkarProgressIfNewDay,
  resetAzkarSet,
  type AzkarProgress,
} from "@/lib/device-local";

// Adhkar reader: tap-counter per dhikr, auto-advance to the next unfinished
// card, daily-reset progress in AsyncStorage `nour.adhkar.progress`. Mirrors
// apps/web/features/adhkar/components/adhkar-reader.tsx.
export default function AdhkarReaderScreen() {
  const { t } = useTranslation();
  const locale = initialLocale;
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const detail = useQuery(adhkarDetailQuery(slug ?? "", locale));
  const azkar = detail.data;
  const items = useMemo<DhikrItem[]>(() => azkar?.items ?? [], [azkar]);
  const repeats = useMemo(() => items.map((i) => i.repeat), [items]);

  const [counts, setCounts] = useState<number[]>([]);
  const listRef = useRef<FlatList<DhikrItem>>(null);

  // Seed counts from device-local progress once the set has loaded (and after
  // a stale-day reset, mirroring the web reader's mount effect).
  useEffect(() => {
    if (azkar == null) return;
    let cancelled = false;
    void resetAzkarProgressIfNewDay()
      .then(() => getAzkarProgress())
      .then((p: AzkarProgress) => {
        if (cancelled) return;
        const set = p.sets[azkar.id] ?? {};
        setCounts(repeats.map((_, i) => set[String(i)] ?? 0));
      });
    return () => {
      cancelled = true;
    };
  }, [azkar?.id]);

  const total = items.length;
  const done = useMemo(
    () => counts.reduce((n, c, i) => n + (c >= (repeats[i] ?? 1) ? 1 : 0), 0),
    [counts, repeats],
  );
  const activeIndex = useMemo(() => {
    const idx = counts.findIndex((c, i) => c < (repeats[i] ?? 1));
    return idx === -1 ? total : idx;
  }, [counts, repeats, total]);
  const hasProgress = counts.some((c) => c > 0);

  const tap = useCallback(
    (i: number) => {
      if (azkar == null) return;
      const item = items[i];
      if (!item) return;
      const current = counts[i] ?? 0;
      if (current >= item.repeat) return; // clamp — ignore over-count

      const next = current + 1;
      void recordDhikrCount(azkar.id, i, next);

      const nextCounts = [...counts];
      nextCounts[i] = next;
      setCounts(nextCounts);

      if (next >= item.repeat && i === activeIndex) {
        const target = nextCounts.findIndex((c, j) => c < (repeats[j] ?? 1));
        if (target !== -1) {
          listRef.current?.scrollToIndex({ index: target, animated: true, viewPosition: 0.3 });
        }
      }
    },
    [azkar, items, counts, repeats, activeIndex],
  );

  const resetAll = useCallback(() => {
    if (azkar == null) return;
    void resetAzkarSet(azkar.id);
    setCounts(items.map(() => 0));
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [azkar, items]);

  if (detail.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Spinner label={t("common.loading")} />
      </View>
    );
  }

  if (detail.isError || azkar == null) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-bg px-4">
        <Text className="text-danger">{t("common.error")}</Text>
        <Button label={t("common.retry")} variant="outline" onPress={() => void detail.refetch()} />
      </View>
    );
  }

  const display = azkar[locale];
  const progressValue = total > 0 ? (done / total) * 100 : 0;

  const header = (
    <View className="gap-3 pb-4">
      <View className="flex-row items-baseline justify-between gap-4">
        <Text variant="display" className="text-2xl text-primary">
          {display.title}
        </Text>
        <Text variant="muted">
          {done} / {total}
        </Text>
      </View>
      <Progress value={progressValue} />
      <View className="flex-row justify-end">
        <Button
          label={t("adhkar.reset")}
          variant="outline"
          size="sm"
          disabled={!hasProgress}
          onPress={resetAll}
        />
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: display.title }} />
      <FlatList<DhikrItem>
        ref={listRef}
        className="flex-1 bg-bg px-4 pt-4"
        data={items}
        keyExtractor={(_, i) => String(i)}
        contentContainerClassName="gap-4 pb-12"
        ListHeaderComponent={header}
        onScrollToIndexFailed={() => undefined}
        renderItem={({ item, index }) => {
          const count = counts[index] ?? 0;
          const isDone = count >= item.repeat;
          const isActive = index === activeIndex;
          const virtue = locale === "ar" ? (item.virtue?.ar ?? item.virtue?.en) : (item.virtue?.en ?? item.virtue?.ar);
          const source = locale === "ar" ? (item.source?.ar ?? item.source?.en) : (item.source?.en ?? item.source?.ar);

          return (
            <View
              className={cn(
                "items-center gap-4 rounded-lg border bg-surface p-6",
                isActive ? "border-primary" : "border-border",
                isDone && "opacity-60",
              )}
            >
              <View className="w-full flex-row items-center justify-between">
                <Text className="rounded-full bg-surface-2 px-3 py-1 text-sm font-medium text-primary">
                  ×{item.repeat}
                </Text>
                {isDone && (
                  <Text className="text-primary" accessibilityLabel={t("adhkar.completed")}>
                    ✓
                  </Text>
                )}
              </View>

              <Text variant="display" className="text-center text-2xl leading-relaxed">
                {item.ar}
              </Text>
              {item.en != null && (
                <Text variant="body" className="text-center text-text-2">
                  {item.en}
                </Text>
              )}
              {item.transliteration != null && (
                <Text variant="muted" className="text-center italic">
                  {item.transliteration}
                </Text>
              )}
              {virtue != null && (
                <Text variant="muted" className="text-center">
                  {virtue}
                </Text>
              )}
              {source != null && (
                <Text variant="muted" className="text-center text-xs">
                  {source}
                </Text>
              )}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("adhkar.countLabel")}
                disabled={isDone}
                onPress={() => tap(index)}
                className={cn(
                  "size-16 items-center justify-center rounded-full border-2 border-primary bg-surface-2",
                  isDone && "opacity-50",
                )}
              >
                <Text className="text-xl font-bold tabular-nums text-text">{count}</Text>
                <Text variant="muted" className="text-xs">
                  / {item.repeat}
                </Text>
              </Pressable>
            </View>
          );
        }}
      />
    </>
  );
}
