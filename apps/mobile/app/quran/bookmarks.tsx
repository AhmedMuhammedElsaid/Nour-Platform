import { useTranslation } from "react-i18next";
import { Stack, useRouter } from "expo-router";
import { ScrollView, View } from "react-native";

import { ScreenHeader } from "@/components/screen-header";
import { Text } from "@/components/ui/text";
import { BookmarksList } from "@/features/quran/components/bookmarks-list";

export default function QuranBookmarksScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 bg-bg">
        <ScreenHeader onBack={() => router.back()} backLabel={t("common.back")} />
        <ScrollView className="flex-1 px-4" contentContainerClassName="py-4">
          <Text variant="display" className="mb-4 text-2xl">
            {t("quran.bookmarks")}
          </Text>
          <BookmarksList />
        </ScrollView>
      </View>
    </>
  );
}
