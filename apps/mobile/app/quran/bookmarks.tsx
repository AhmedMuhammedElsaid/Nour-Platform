import { useTranslation } from "react-i18next";
import { Stack } from "expo-router";
import { ScrollView } from "react-native";

import { Text } from "@/components/ui/text";
import { BookmarksList } from "@/features/quran/components/bookmarks-list";

export default function QuranBookmarksScreen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t("quran.bookmarks") }} />
      <ScrollView className="flex-1 bg-bg px-4" contentContainerClassName="py-4">
        <Text variant="display" className="mb-4 text-2xl">
          {t("quran.bookmarks")}
        </Text>
        <BookmarksList />
      </ScrollView>
    </>
  );
}
