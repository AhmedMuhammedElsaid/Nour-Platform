import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FlatList, Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { CategoryPills } from "@/features/home/components/category-pills";
import { ContinueListening } from "@/features/home/components/continue-listening";
import { ContinueReading } from "@/features/home/components/continue-reading";
import { SortSelect, type SortOption } from "@/features/home/components/sort-select";
import { PlaylistCard } from "@/features/playlists/components/playlist-card";
import { initialLocale } from "@/lib/i18n";
import { categoriesQuery, playlistsQuery } from "@/lib/queries";
import type { CategoryChip } from "@/lib/types";

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = initialLocale;

  const playlists = useQuery(playlistsQuery(locale));
  const categories = useQuery(categoriesQuery());

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>("newest");

  const categoryById = useMemo(
    () =>
      new Map<string, CategoryChip>(
        (categories.data ?? []).map((c) => [c.id, { slug: c[locale].slug, name: c[locale].name }]),
      ),
    [categories.data, locale],
  );

  const pills = useMemo(
    () => (categories.data ?? []).map((c) => ({ id: c.id, slug: c[locale].slug, name: c[locale].name })),
    [categories.data, locale],
  );

  const visible = useMemo(() => {
    let list = playlists.data ?? [];
    if (activeCategory != null) list = list.filter((p) => p.categoryIds.includes(activeCategory));
    const sorted = [...list];
    if (sort === "az") {
      sorted.sort((a, b) => a[locale].title.localeCompare(b[locale].title, locale));
    } else if (sort === "tracks") {
      sorted.sort((a, b) => (b.trackCount ?? 0) - (a.trackCount ?? 0));
    }
    return sorted;
  }, [playlists.data, activeCategory, sort, locale]);

  const header = (
    <View className="gap-6 pb-4">
      <View>
        <Text variant="display" className="text-4xl">
          {t("home.heroTitle")}
        </Text>
        <Text variant="muted" className="mt-2">
          {t("home.heroSubtitle")}
        </Text>
      </View>

      {/* Primary nav — bottom tabs land in Phase 10; a simple link row gets
          Adhkar reachable for this phase's gate. */}
      <Pressable accessibilityRole="button" onPress={() => router.push("/adhkar")}>
        <Card className="flex-row items-center justify-between p-4">
          <Text variant="title">{t("nav.adhkar")}</Text>
          <Text variant="muted">{locale === "ar" ? "←" : "→"}</Text>
        </Card>
      </Pressable>

      <CategoryPills
        categories={pills}
        activeId={activeCategory}
        onSelect={setActiveCategory}
        allLabel={t("home.allCategories")}
      />

      <View className="flex-row items-center justify-between gap-4">
        <Text variant="label">{t("home.library")}</Text>
        <SortSelect value={sort} onChange={setSort} />
      </View>
    </View>
  );

  if (playlists.isPending) {
    return (
      <View className="flex-1 bg-bg px-4 pt-16">
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
      <View className="flex-1 items-center justify-center gap-3 bg-bg px-4">
        <Text className="text-danger">{t("common.error")}</Text>
        <Button label={t("common.retry")} variant="outline" onPress={() => void playlists.refetch()} />
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-bg px-4 pt-16"
      data={visible}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperClassName="gap-3"
      contentContainerClassName="gap-3 pb-12"
      ListHeaderComponent={header}
      ListEmptyComponent={<Text variant="muted">{t("home.empty")}</Text>}
      renderItem={({ item }) => (
        <View className="flex-1">
          <PlaylistCard
            playlist={item}
            locale={locale}
            categories={item.categoryIds
              .map((id) => categoryById.get(id))
              .filter((c): c is CategoryChip => c != null)}
          />
        </View>
      )}
      ListFooterComponent={
        <View>
          <ContinueListening />
          <ContinueReading />
        </View>
      }
    />
  );
}
