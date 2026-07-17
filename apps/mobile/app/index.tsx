import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { DeveloperFooter } from "@/components/developer-footer";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { CategoryPills } from "@/features/home/components/category-pills";
import { ContinueListening } from "@/features/home/components/continue-listening";
import { ContinueReading } from "@/features/home/components/continue-reading";
import { RecitersShelf } from "@/features/home/components/reciters-shelf";
import { RadioPreviewShelf } from "@/features/radio/components/radio-preview-shelf";
import { AdhkarPreviewShelf } from "@/features/home/components/adhkar-preview-shelf";
import { DhikrOfTheDayCard } from "@/features/home/components/dhikr-of-the-day-card";
import { QiblaHomeCard } from "@/features/qibla/components/qibla-home-card";
import { SortSelect, type SortOption } from "@/features/home/components/sort-select";
import { PlaylistCard } from "@/features/playlists/components/playlist-card";
import { PrayerTimesWidget } from "@/features/prayer-times/components/prayer-times-widget";
import type { Playlist } from "@repo/shared-core/schemas/playlist";
import { pickHeroTextOfTheDay } from "@repo/shared-core/hero-text";
import { initialLocale } from "@/lib/i18n";
import { categoriesQuery, playlistsQuery } from "@/lib/queries";
import type { CategoryChip } from "@/lib/types";
import { useDockSpacing } from "@/lib/use-dock-spacing";

export default function HomeScreen() {
  const { t } = useTranslation();
  const locale = initialLocale;
  const dockSpacing = useDockSpacing();
  const insets = useSafeAreaInsets();
  const topPad = insets.top + 12;

  const playlists = useQuery(playlistsQuery(locale));
  const categories = useQuery(categoriesQuery());
  const heroSubtitle = useMemo(() => pickHeroTextOfTheDay(locale), [locale]);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  // Default to "all": render every playlist in its original order on first load.
  const [sort, setSort] = useState<SortOption>("all");

  const categoryById = useMemo(
    () =>
      new Map<string, CategoryChip>(
        (categories.data ?? []).flatMap((c) => {
          const cl = c[locale] ?? c.ar ?? c.en;
          return cl ? [[c.id, { slug: cl.slug, name: cl.name }] as const] : [];
        }),
      ),
    [categories.data, locale],
  );

  const pills = useMemo(
    () =>
      (categories.data ?? []).flatMap((c) => {
        const cl = c[locale] ?? c.ar ?? c.en;
        return cl ? [{ id: c.id, slug: cl.slug, name: cl.name }] : [];
      }),
    [categories.data, locale],
  );

  const visible = useMemo(() => {
    // Resolve a sortable title that tolerates a row missing the active-locale
    // object (falls back to the other locale, then ""). Without this, one such
    // row makes the A–Z comparator throw inside this memo and blanks the WHOLE
    // grid — "newest" only escaped because it doesn't read [locale] here and the
    // FlatList virtualizes the offending card off-screen. (Matching fallback in
    // PlaylistCard so the card itself can't crash either.)
    const titleOf = (p: Playlist): string => p[locale]?.title ?? p.ar?.title ?? p.en?.title ?? "";
    let list = playlists.data ?? [];
    if (activeCategory != null) list = list.filter((p) => p.categoryIds.includes(activeCategory));
    const sorted = [...list];
    if (sort === "az") {
      sorted.sort((a, b) => titleOf(a).localeCompare(titleOf(b), locale));
    } else if (sort === "tracks") {
      sorted.sort((a, b) => (b.trackCount ?? 0) - (a.trackCount ?? 0));
    }
    return sorted;
  }, [playlists.data, activeCategory, sort, locale]);

  // Precomputed per-playlist category-chip arrays, keyed by playlist id — so
  // each <PlaylistCard>'s `categories` prop is a STABLE reference across
  // renders that don't actually change the playlist/category data. Without
  // this, `item.categoryIds.map(...).filter(...)` built a fresh array inline
  // on every render, which would defeat PlaylistCard's React.memo.
  const categoriesByPlaylistId = useMemo(
    () =>
      new Map<string, CategoryChip[]>(
        visible.map((item) => [
          item.id,
          item.categoryIds
            .map((id) => categoryById.get(id))
            .filter((c): c is CategoryChip => c != null),
        ]),
      ),
    [visible, categoryById],
  );

  const header = (
    <View className="gap-6 pb-4">
      {/* Top bar: theme toggle + locale switcher */}
      <View className="flex-row items-center justify-between">
        <Text variant="display" className="text-xl">
          {t("common.appName")}
        </Text>
        <View className="flex-row items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
        </View>
      </View>

      <View>
        <Text variant="display" className="text-3xl sm:text-4xl">
          {t("home.heroTitle")}
        </Text>
        <Text variant="muted" className="mt-2 text-base sm:text-lg">
          {heroSubtitle}
        </Text>
      </View>

      {/* Live prayer-times arc (sun by day, moon by night) — same widget the
          web home mounts; tapping opens the full /prayer-times screen. */}
      <PrayerTimesWidget />

      <CategoryPills
        categories={pills}
        activeId={activeCategory}
        onSelect={setActiveCategory}
        allLabel={t("home.allCategories")}
      />
    </View>
  );

  // The library heading + sort row, pulled out of `header` so the Readers shelf
  // can sit above the whole Library section (label + grid), per user request.
  const libraryBar = (
    <View className="mb-4 mt-6 flex-row items-center justify-between gap-4">
      <Text variant="label">{t("home.library")}</Text>
      <SortSelect value={sort} onChange={setSort} />
    </View>
  );

  if (playlists.isPending) {
    return (
      <View className="bg-bg flex-1 px-4" style={{ paddingTop: topPad }}>
        {header}
        <View className="flex-row flex-wrap gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} className="w-[48%] gap-2">
              <Skeleton className="aspect-square w-full" />
              <Skeleton className="h-4 w-3/4" />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (playlists.isError) {
    return (
      <View className="bg-bg flex-1 items-center justify-center gap-3 px-4">
        <Text className="text-danger">{t("common.error")}</Text>
        <Button
          label={t("common.retry")}
          variant="outline"
          onPress={() => void playlists.refetch()}
        />
      </View>
    );
  }

  return (
    <View className="bg-bg flex-1">
      {/* A ScrollView + flex-wrap grid (the same deterministic layout the loading
          skeleton uses), NOT a numColumns FlatList. FlatList computed its
          multi-column cell positions once on mount while the header was still
          growing (the PrayerTimesWidget returns null until usePrayerSettings
          hydrates from AsyncStorage), so the cards overlapped on first paint and
          on every remount, only correcting when a filter change forced a full
          re-layout. flex-wrap lays each row out naturally, so there is nothing to
          mis-measure. The home list is small, so dropping virtualization is fine. */}
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: topPad, paddingBottom: dockSpacing }}
        showsVerticalScrollIndicator={false}
      >
        {header}
        {/* Readers shelf sits above the Library section (user request). */}
        <View className="mt-3">
          <QiblaHomeCard />
        </View>
        <RecitersShelf />
        <RadioPreviewShelf />
        <DhikrOfTheDayCard />
        <AdhkarPreviewShelf />
        {libraryBar}
        {visible.length === 0 ? (
          <Text variant="muted">{t("home.empty")}</Text>
        ) : (
          <View className="flex-row flex-wrap gap-3">
            {visible.map((item) => (
              <View key={item.id} className="w-[48%]">
                <PlaylistCard
                  playlist={item}
                  locale={locale}
                  categories={categoriesByPlaylistId.get(item.id) ?? []}
                />
              </View>
            ))}
          </View>
        )}
        <View className="mt-3">
          <ContinueListening />
          <ContinueReading />
        </View>
        <DeveloperFooter />
      </ScrollView>
      {/* Opaque scrim filling the status-bar area so content scrolled up the
          screen is hidden behind it instead of bleeding under the transparent
          status bar (the clipped hero subtitle in the report). */}
      <View
        pointerEvents="none"
        className="bg-bg absolute left-0 right-0 top-0"
        style={{ height: insets.top }}
      />
    </View>
  );
}
