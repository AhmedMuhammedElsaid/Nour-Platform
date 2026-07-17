import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FlatList, Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { initialLocale } from "@/lib/i18n";
import { adhkarListQuery } from "@/lib/queries";
import { useDockSpacing } from "@/lib/use-dock-spacing";
import {
  azkarCompletedCount,
  getAzkarProgress,
  resetAzkarProgressIfNewDay,
  type AzkarProgress,
} from "@/lib/device-local";

// Adhkar landing — a grid of sets (morning/evening/other), each showing a
// daily-progress bar driven by device-local AsyncStorage state. Mirrors the
// web `/adhkar` listing; reads-only here (writes happen in the reader screen).
export default function AdhkarListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = initialLocale;
  const dockSpacing = useDockSpacing();

  const azkar = useQuery(adhkarListQuery());
  const [progress, setProgress] = useState<AzkarProgress | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resetAzkarProgressIfNewDay().then((p) => {
      if (!cancelled) setProgress(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-read progress whenever the screen regains focus would be ideal (e.g.
  // `useFocusEffect`), but a plain mount-time read is sufficient for Phase 5 —
  // the reader screen records as the user taps, and returning here re-mounts
  // via the stack navigator's default behavior in this app.
  useEffect(() => {
    if (progress == null) void getAzkarProgress().then(setProgress);
  }, [progress]);

  if (azkar.isPending) {
    return (
      <View className="flex-1 gap-3 bg-bg px-4 pt-16">
        <Text variant="display">{t("adhkar.heading")}</Text>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </View>
    );
  }

  if (azkar.isError && !azkar.data) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-bg px-4">
        <Text className="text-danger">{t("common.error")}</Text>
        <Button label={t("common.retry")} variant="outline" onPress={() => void azkar.refetch()} />
      </View>
    );
  }

  const sets = azkar.data ?? [];

  return (
    <FlatList
      className="flex-1 bg-bg px-4 pt-16"
      data={sets}
      keyExtractor={(item) => item.id}
      contentContainerClassName="gap-3"
      contentContainerStyle={{ paddingBottom: dockSpacing }}
      ListHeaderComponent={
        <Text variant="display" className="mb-2">
          {t("adhkar.heading")}
        </Text>
      }
      ListEmptyComponent={<Text variant="muted">{t("adhkar.empty")}</Text>}
      renderItem={({ item }) => {
        const display = item[locale] ?? item.ar ?? item.en;
        if (display == null) return null;
        const repeats = item.items.map((d) => d.repeat);
        const done = progress != null ? azkarCompletedCount(progress, item.id, repeats) : 0;
        const total = repeats.length;
        const value = total > 0 ? (done / total) * 100 : 0;

        return (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/adhkar/${encodeURIComponent(display.slug)}`)}
          >
            <Card className="gap-2 p-4">
              <Text variant="title">{display.title}</Text>
              <Progress value={value} />
              <Text variant="muted">
                {done} / {total}
              </Text>
            </Card>
          </Pressable>
        );
      }}
    />
  );
}
