import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";

import { Text } from "@/components/ui/text";
import { radioStationsQuery } from "@/lib/queries";

// Home entry point for the Radio module — a tappable card that opens the full
// /radio screen (the way the prayer-times screen opens /qibla). Renders nothing
// until at least one station is available, so an empty catalog shows no card.
export function RadioHomeCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data } = useQuery(radioStationsQuery());

  const count = (data ?? []).length;
  if (count === 0) return null;

  return (
    <View className="mt-8">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("radio.title")}
        onPress={() => router.push("/radio")}
        className="flex-row items-center gap-4 rounded-xl border border-border bg-surface p-4"
      >
        <View className="size-12 items-center justify-center rounded-lg bg-primary/10">
          <Text className="text-2xl">📻</Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text variant="body" className="font-medium">{t("radio.title")}</Text>
          <Text variant="muted" numberOfLines={1}>{t("radio.homeCardSubtitle")}</Text>
        </View>
        <Text variant="muted" className="text-xl">›</Text>
      </Pressable>
    </View>
  );
}
