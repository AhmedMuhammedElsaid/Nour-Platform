import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";

import { Text } from "@/components/ui/text";

// Home entry point for the Qibla compass — a tappable card that opens the full
// /qibla screen. Makes the compass discoverable from Home, matching the web's
// nav link, in addition to the prayer-times banner.
export function QiblaHomeCard() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View className="mt-8">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("qibla.title")}
        onPress={() => router.push("/qibla")}
        className="flex-row items-center gap-4 rounded-xl border border-border bg-surface p-4"
      >
        <View className="size-12 items-center justify-center rounded-lg bg-primary/10">
          <Text className="text-2xl">🕋</Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text variant="body" className="font-medium">{t("qibla.title")}</Text>
          <Text variant="muted" numberOfLines={1}>{t("qibla.homeCardSubtitle")}</Text>
        </View>
        <Text variant="muted" className="text-xl">›</Text>
      </Pressable>
    </View>
  );
}
