import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, FlatList, Text, View } from "react-native";

import { playlistsQuery } from "@/lib/queries";
import { initialLocale } from "@/lib/i18n";

export default function HomeScreen() {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = useQuery(playlistsQuery());

  return (
    <View className="flex-1 bg-bg px-4 pt-16">
      <Text className="font-display text-2xl text-text">{t("home.playlistsTitle")}</Text>

      {isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#c8a050" />
          <Text className="mt-2 text-text-2">{t("common.loading")}</Text>
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center gap-2">
          <Text className="text-danger">{t("common.error")}</Text>
          <Text className="text-primary" onPress={() => void refetch()}>
            {t("common.retry")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View className="border-border border-b py-3">
              <Text className="text-text">{item[initialLocale].title}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
