import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  resolveEntryPart,
  settlePart,
  type PendingPart,
} from "@repo/shared-core/quran/page-parts";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  quranPageReaderQuery,
  quranRecitersQuery,
  quranSurahReaderQuery,
  quranSurahsQuery,
} from "@/lib/queries";

export default function QuranReaderScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const locale = initialLocale;
  const { surah, autoplay } = useLocalSearchParams<{ surah: string; autoplay?: string }>();
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

  const isMushaf = prefs.layout === "mushaf";

  // Every entry point (surah list, bookmarks, search, continue-reading, the
  // Readers shelf) still links by SURAH NUMBER — Mushaf/page mode resolves
  // the entry surah's starting page from the cached surah index (immutable
  // reference data, staleTime Infinity) once, then browses by page from there.
  const surahs = useQuery(quranSurahsQuery());
  const surahMeta = surahs.data?.find((s) => s.number === surahNumber);
  const [currentPage, setCurrentPage] = useState<number | null>(null);
  useEffect(() => {
    if (currentPage === null && surahMeta) setCurrentPage(surahMeta.pageStart);
  }, [currentPage, surahMeta]);

  // A Madani page can straddle a surah boundary (p.293 = Al-Israa's tail +
  // Al-Kahf's opening) — the reader shows one SEGMENT ("part") per flip, not
  // the whole page. `null` means "not yet navigated": resolve the entry part
  // from `entrySurah` once the page arrives (Al-Kahf routes to p.293 whose
  // segment 0 is Al-Israa, so this is NOT always 0). Once the reader starts
  // paging with Prev/Next/swipe it sets an explicit target ("first"/"last"/a
  // concrete index) here — kept in THIS component (not inside <Reader>)
  // because the `active.isPending` gate below unmounts <Reader> on every page
  // change, which would otherwise wipe out any pending-part intent before the
  // new page's segment count is known to settle it against.
  const [partIntent, setPartIntent] = useState<number | PendingPart | null>(null);
  const onChangePage = (page: number, part: number | PendingPart) => {
    setCurrentPage(page);
    setPartIntent(part);
  };

  // List mode's fetch is byte-for-byte the same query as before.
  const surahReader = useQuery({
    ...quranSurahReaderQuery(surahNumber, locale, prefs.translationSlug, prefs.reciterSlug),
    enabled: hydrated && !isMushaf && Number.isInteger(surahNumber),
  });
  const pageReader = useQuery({
    ...quranPageReaderQuery(currentPage ?? 1, locale, prefs.translationSlug, prefs.reciterSlug),
    enabled: hydrated && isMushaf && currentPage !== null,
  });
  const editions = useQuery(quranEditionsQuery());
  const reciters = useQuery(quranRecitersQuery());

  const active = isMushaf ? pageReader : surahReader;
  const resolvingPage = isMushaf && currentPage === null;

  // Settle `partIntent` against the arrived page's actual segment count. Pure
  // derivation (not an effect) so there's no extra render between the new
  // page landing and the correct segment showing.
  const part = useMemo(() => {
    if (!pageReader.data) return 0;
    if (partIntent === null) {
      return resolveEntryPart(
        pageReader.data.segments.map((s) => s.surah.number),
        surahNumber,
      );
    }
    return settlePart(partIntent, pageReader.data.segments.length);
  }, [pageReader.data, partIntent, surahNumber]);

  if (!hydrated || resolvingPage || active.isPending) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 gap-4 bg-bg px-4" style={{ paddingTop: insets.top + 8 }}>
          <BackRow onBack={() => router.back()} label={t("common.back")} />
          <View className="items-center gap-3 border-b border-border pb-4">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-40" />
          </View>
          <View className="gap-4 pt-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </View>
        </View>
      </>
    );
  }

  if (active.isError && !active.data) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
          <BackRow onBack={() => router.back()} label={t("common.back")} />
          <View className="flex-1 items-center justify-center gap-3 px-4">
            <Text className="text-danger">{t("common.error")}</Text>
            <Button label={t("common.retry")} variant="outline" onPress={() => void active.refetch()} />
          </View>
        </View>
      </>
    );
  }

  // Unreachable once isPending/isError-without-data are both handled above —
  // kept only so TS narrows `active.data` to non-null below.
  if (!active.data) return null;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Reader
        data={isMushaf ? null : (surahReader.data ?? null)}
        pageData={isMushaf ? (pageReader.data ?? null) : null}
        part={part}
        onChangePage={onChangePage}
        editions={editions.data ?? []}
        reciters={reciters.data ?? []}
        locale={locale}
        prefs={prefs}
        onChangePrefs={onChangePrefs}
        onBack={() => router.back()}
        autoStart={autoplay === "1"}
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
