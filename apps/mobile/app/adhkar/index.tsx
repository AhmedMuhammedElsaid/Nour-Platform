import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FlatList, Pressable, View } from "react-native";

import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { initialLocale } from "@/lib/i18n";
import { goBackOrHome } from "@/lib/nav";
import { adhkarListQuery } from "@/lib/queries";
import { useDockSpacing } from "@/lib/use-dock-spacing";
import { useTheme } from "@/lib/theme-context";
import {
  azkarCompletedCount,
  getAzkarProgress,
  resetAzkarProgressIfNewDay,
  type AzkarProgress,
} from "@/lib/device-local";

const KIND_EMOJI: Record<"morning" | "evening" | "other", string> = {
  morning: "🌅",
  evening: "🌙",
  other: "📿",
};

// NativeWind's `bg-<token>/NN` opacity modifier silently no-ops against a CSS
// custom-property color (no error) — resolve the tint as a literal rgba() by
// theme instead (same workaround as tab-icons.tsx's TEXT_HEX maps).
const ICON_TINT: Record<"dark" | "light", string> = {
  dark: "rgba(200, 160, 80, 0.12)",
  light: "rgba(154, 120, 48, 0.12)",
};

// Adhkar landing — a grid of sets (morning/evening/other), each showing a
// daily-progress bar driven by device-local AsyncStorage state. Mirrors the
// web `/adhkar` listing; reads-only here (writes happen in the reader screen).
export default function AdhkarListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { theme } = useTheme();
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
      <View className="flex-1 bg-bg">
        <ScreenHeader title={t("adhkar.heading")} onBack={goBackOrHome} backLabel={t("common.back")} />
        <View className="flex-1 gap-3 px-4 pt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </View>
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
    <View className="flex-1 bg-bg">
      <ScreenHeader title={t("adhkar.heading")} onBack={goBackOrHome} backLabel={t("common.back")} />
      <FlatList
        className="flex-1 px-4 pt-4"
        data={sets}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-3"
        contentContainerStyle={{ paddingBottom: dockSpacing }}
        initialNumToRender={12}
        windowSize={7}
        removeClippedSubviews
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
                <View
                  className="h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: ICON_TINT[theme] }}
                >
                  <Text className="text-xl">{KIND_EMOJI[item.kind]}</Text>
                </View>
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
    </View>
  );
}
