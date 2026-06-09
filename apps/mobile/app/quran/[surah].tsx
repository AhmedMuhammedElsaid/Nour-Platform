import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Reader } from "@/features/quran/components/reader";
import { initialLocale } from "@/lib/i18n";
import {
  DEFAULT_QURAN_PREFS,
  getQuranPrefs,
  setQuranPrefs,
  type QuranPrefs,
} from "@/lib/device-local";
import {
  quranEditionsQuery,
  quranRecitersQuery,
  quranSurahReaderQuery,
} from "@/lib/queries";

export default function QuranReaderScreen() {
  const { t } = useTranslation();
  const locale = initialLocale;
  const { surah } = useLocalSearchParams<{ surah: string }>();
  const surahNumber = Number(surah);

  // Prefs drive the fetch key (translation/reciter) — hydrate from device-local
  // before fetching so a returning user gets their chosen edition.
  const [prefs, setPrefs] = useState<QuranPrefs>(DEFAULT_QURAN_PREFS);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    void getQuranPrefs().then((p) => {
      setPrefs(p);
      setHydrated(true);
    });
  }, []);

  const onChangePrefs = (next: QuranPrefs) => {
    setPrefs(next);
    void setQuranPrefs(next);
  };

  const reader = useQuery({
    ...quranSurahReaderQuery(surahNumber, locale, prefs.translationSlug, prefs.reciterSlug),
    enabled: hydrated && Number.isInteger(surahNumber),
  });
  const editions = useQuery(quranEditionsQuery());
  const reciters = useQuery(quranRecitersQuery());

  if (!hydrated || reader.isPending) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: t("quran.title") }} />
        <View className="flex-1 items-center justify-center bg-bg">
          <Text variant="muted">{t("common.loading")}</Text>
        </View>
      </>
    );
  }

  if (reader.isError || !reader.data) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: t("quran.title") }} />
        <View className="flex-1 items-center justify-center gap-3 bg-bg px-4">
          <Text className="text-danger">{t("common.error")}</Text>
          <Button label={t("common.retry")} variant="outline" onPress={() => void reader.refetch()} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: reader.data.surah.name.en }} />
      <Reader
        data={reader.data}
        editions={editions.data ?? []}
        reciters={reciters.data ?? []}
        locale={locale}
        prefs={prefs}
        onChangePrefs={onChangePrefs}
      />
    </>
  );
}
