import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
  const router = useRouter();
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
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 bg-bg">
          <BackRow onBack={() => router.back()} label={t("common.back")} />
          <View className="flex-1 items-center justify-center">
            <Spinner label={t("common.loading")} />
          </View>
        </View>
      </>
    );
  }

  if (reader.isError || !reader.data) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 bg-bg">
          <BackRow onBack={() => router.back()} label={t("common.back")} />
          <View className="flex-1 items-center justify-center gap-3 px-4">
            <Text className="text-danger">{t("common.error")}</Text>
            <Button label={t("common.retry")} variant="outline" onPress={() => void reader.refetch()} />
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Reader
        data={reader.data}
        editions={editions.data ?? []}
        reciters={reciters.data ?? []}
        locale={locale}
        prefs={prefs}
        onChangePrefs={onChangePrefs}
        onBack={() => router.back()}
      />
    </>
  );
}

// Minimal themed back affordance for the loading/error states (the success
// state's back button lives in the Reader's own header, next to the title).
function BackRow({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <View className="flex-row items-center px-2 pt-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onBack}
        className="size-9 items-center justify-center"
      >
        <Text className="text-2xl text-text">‹</Text>
      </Pressable>
    </View>
  );
}
