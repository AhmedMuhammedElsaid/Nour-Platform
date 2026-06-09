import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { getQuranBookmarks, type AyahRef } from "@/lib/device-local";

// RN port of apps/web/features/quran/components/bookmarks-list.tsx — bookmarks
// grouped by surah, each ayah a chip that deep-links into the reader.
export function BookmarksList() {
  const { t } = useTranslation();
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<AyahRef[]>([]);

  useEffect(() => {
    void getQuranBookmarks().then(setBookmarks);
  }, []);

  if (bookmarks.length === 0) {
    return (
      <Text variant="muted" className="py-8 text-center" accessibilityLabel="bookmarks-empty">
        {t("quran.bookmarksEmpty")}
      </Text>
    );
  }

  const groups = new Map<number, { name: string; items: AyahRef[] }>();
  for (const b of bookmarks) {
    const g = groups.get(b.surah) ?? {
      name: b.surahName ?? `${t("quran.surah")} ${b.surah}`,
      items: [],
    };
    g.items.push(b);
    groups.set(b.surah, g);
  }

  return (
    <View>
      {[...groups.entries()].map(([surah, g]) => (
        <View key={surah} className="border-b border-border py-3">
          <Text className="mb-2 font-medium text-text">{g.name}</Text>
          <View className="flex-row flex-wrap gap-2">
            {g.items.map((b) => (
              <Pressable
                key={`${b.surah}:${b.ayahInSurah}`}
                accessibilityRole="button"
                onPress={() => router.push(`/quran/${b.surah}`)}
                className="rounded-full border border-border px-3 py-1"
              >
                <Text variant="muted" className="text-sm">{b.ayahInSurah}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
