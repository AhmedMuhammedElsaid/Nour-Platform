import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { FlatList, Pressable, View } from "react-native";
import type { QuranSurah } from "@repo/shared-core/schemas/quran";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { SurahCard } from "@/features/quran/components/surah-index";
import { SurahJuzTabs, type ReaderTab } from "@/features/quran/components/surah-juz-tabs";
import { getQuranLastRead } from "@/lib/device-local";
import { quranSurahsQuery } from "@/lib/queries";
import { useDockSpacing } from "@/lib/use-dock-spacing";

export default function QuranIndexScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dockSpacing = useDockSpacing();
  const [tab, setTab] = useState<ReaderTab>("surah");
  const surahs = useQuery(quranSurahsQuery());
  const lastRead = useQuery({
    queryKey: ["quran-last-read"] as const,
    queryFn: getQuranLastRead,
    staleTime: 0,
  });

  // Only one surah can carry a progress ring — the device only stores a
  // single last-read pointer, not per-surah history (mirrors the web grid).
  const progress = useMemo(() => {
    const ref = lastRead.data;
    const surah = ref && surahs.data?.find((s) => s.number === ref.surah);
    if (!ref || !surah) return null;
    return { surah: ref.surah, pct: Math.min(100, Math.round((ref.ayahInSurah / surah.ayahCount) * 100)) };
  }, [lastRead.data, surahs.data]);

  const header = (
    <View className="gap-4 pb-2">
      <Text variant="display" className="text-3xl">
        {t("quran.title")}
      </Text>
      <Pressable accessibilityRole="button" onPress={() => router.push("/quran/bookmarks")}>
        <Card className="flex-row items-center justify-between p-4">
          <Text variant="title">{t("quran.bookmarks")}</Text>
          <Text variant="muted">🔖</Text>
        </Card>
      </Pressable>
      <SurahJuzTabs tab={tab} onChange={setTab} />
    </View>
  );

  if (surahs.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Spinner label={t("common.loading")} />
      </View>
    );
  }

  if (surahs.isError) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-bg px-4">
        <Text className="text-danger">{t("common.error")}</Text>
        <Button label={t("common.retry")} variant="outline" onPress={() => void surahs.refetch()} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {tab === "surah" ? (
        <FlatList<QuranSurah>
          className="flex-1 bg-bg px-4 pt-16"
          data={surahs.data}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          keyExtractor={(s) => String(s.number)}
          contentContainerStyle={{ paddingBottom: dockSpacing }}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <SurahCard
              surah={item}
              progressPct={progress?.surah === item.number ? progress.pct : null}
            />
          )}
        />
      ) : (
        <View className="flex-1 bg-bg px-4 pt-16">
          {header}
          <Text variant="muted" className="py-8 text-center">
            {t("quran.juzPlaceholder")}
          </Text>
        </View>
      )}
    </>
  );
}
