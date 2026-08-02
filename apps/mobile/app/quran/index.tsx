import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { FlatList, Pressable, SectionList, View } from "react-native";
import { JUZ_BOUNDARIES, surahsInJuz } from "@repo/shared-core/quran/juz";
import type { JuzSurahEntry } from "@repo/shared-core/quran/juz";
import type { QuranSurah } from "@repo/shared-core/schemas/quran";

import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { JuzRow } from "@/features/quran/components/juz-shelf";
import { SurahCard } from "@/features/quran/components/surah-index";
import { SurahJuzTabs, type ReaderTab } from "@/features/quran/components/surah-juz-tabs";
import { getQuranLastRead } from "@/lib/device-local";
import { goBackOrHome } from "@/lib/nav";
import { DEVICE_LOCAL_FRESHNESS, quranSurahsQuery } from "@/lib/queries";
import { useDockSpacing } from "@/lib/use-dock-spacing";

// Module-level: a fresh options object each render makes the navigator re-apply
// them. The screen draws its own themed header (see APP_CONTEXT: prefer
// headerShown:false + <ScreenHeader> over the native header).
const HEADERLESS = { headerShown: false } as const;

export default function QuranIndexScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  // 2026-07-30: the shared 8dp base left the LAST grid row (surah 113/114 or
  // the last juz row) fully hidden under the bottom tab bar — on-device pixel
  // check showed the tab bar's own rendered height (icon+label row + padding,
  // ~71dp on the A72) swallows the whole row, not just its bottom edge.
  // Extend locally rather than raising the shared base (see use-dock-spacing.ts).
  const dockSpacing = useDockSpacing() + 88;
  const [tab, setTab] = useState<ReaderTab>("surah");
  const surahs = useQuery(quranSurahsQuery());
  const lastRead = useQuery({
    queryKey: ["quran-last-read"] as const,
    queryFn: getQuranLastRead,
    ...DEVICE_LOCAL_FRESHNESS,
  });

  // Only one surah can carry a progress ring — the device only stores a
  // single last-read pointer, not per-surah history (mirrors the web grid).
  const progress = useMemo(() => {
    const ref = lastRead.data;
    const surah = ref && surahs.data?.find((s) => s.number === ref.surah);
    if (!ref || !surah) return null;
    return { surah: ref.surah, pct: Math.min(100, Math.round((ref.ayahInSurah / surah.ayahCount) * 100)) };
  }, [lastRead.data, surahs.data]);

  const surahByNumber = useMemo(
    () => new Map((surahs.data ?? []).map((s) => [s.number, s])),
    [surahs.data],
  );
  // The 30 juz boundaries are fixed/universal (packages/shared-core), so no
  // extra fetch — surahsInJuz() just slices the already-fetched surah list.
  const juzSections = useMemo(
    () => JUZ_BOUNDARIES.map((b) => ({ title: `Juz ${b.juz}`, data: surahsInJuz(b.juz, surahs.data ?? []) })),
    [surahs.data],
  );

  // memo'd alongside the renderItem callbacks below so <SurahCard>'s React.memo
  // actually holds — an unstable header/renderItem re-renders all 114 rows.
  const header = useMemo(
    () => (
    <View className="gap-4 pb-2 pt-4">
      <Pressable accessibilityRole="button" onPress={() => router.push("/quran/bookmarks")}>
        <Card className="flex-row items-center justify-between p-4">
          <Text variant="title">{t("quran.bookmarks")}</Text>
          <Text variant="muted">🔖</Text>
        </Card>
      </Pressable>
      <SurahJuzTabs tab={tab} onChange={setTab} />
    </View>
    ),
    [t, router, tab],
  );

  const renderSurah = useCallback(
    ({ item }: { item: QuranSurah }) => (
      <SurahCard
        surah={item}
        progressPct={progress?.surah === item.number ? progress.pct : null}
      />
    ),
    [progress],
  );

  const renderJuzRow = useCallback(
    ({ item }: { item: JuzSurahEntry }) => {
      const surah = surahByNumber.get(item.number);
      return surah ? <JuzRow entry={item} surah={surah} /> : null;
    },
    [surahByNumber],
  );

  if (surahs.isPending) {
    return (
      <View className="flex-1 bg-bg">
        <ScreenHeader title={t("quran.title")} onBack={goBackOrHome} backLabel={t("common.back")} />
        <View className="flex-1 gap-4 px-4 pt-4">
          <View className="flex-row flex-wrap gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <View
                key={i}
                className="w-[48%] gap-2 rounded-xl border border-border bg-surface p-3"
              >
                <Skeleton className="h-11 w-11 rounded-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  if (surahs.isError && !surahs.data) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-bg px-4">
        <Text className="text-danger">{t("common.error")}</Text>
        <Button label={t("common.retry")} variant="outline" onPress={() => void surahs.refetch()} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={HEADERLESS} />
      <View className="flex-1 bg-bg">
        <ScreenHeader title={t("quran.title")} onBack={goBackOrHome} backLabel={t("common.back")} />
        {tab === "surah" ? (
          <FlatList<QuranSurah>
            className="flex-1 px-4"
            data={surahs.data}
            numColumns={2}
            columnWrapperStyle={{ gap: 12 }}
            keyExtractor={(s) => String(s.number)}
            contentContainerStyle={{ paddingBottom: dockSpacing }}
            ListHeaderComponent={header}
            renderItem={renderSurah}
            initialNumToRender={10}
            windowSize={7}
            removeClippedSubviews
          />
        ) : (
          <SectionList
            className="flex-1 px-4"
            sections={juzSections}
            keyExtractor={(entry, index) => `${entry.number}-${index}`}
            contentContainerStyle={{ paddingBottom: dockSpacing }}
            ListHeaderComponent={header}
            renderSectionHeader={({ section }) => (
              <Text className="font-display mt-3 mb-1 text-lg text-primary">{section.title}</Text>
            )}
            renderItem={renderJuzRow}
            initialNumToRender={12}
            windowSize={7}
            removeClippedSubviews
          />
        )}
      </View>
    </>
  );
}
