import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { getQuranLastRead } from "@/lib/device-local";

// Device-local Quran "continue reading" shelf. The writer (Quran reader) lands
// in Phase 8; until then the read returns null and the shelf renders nothing.
export function ContinueReading() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data } = useQuery({
    queryKey: ["quran-last-read"] as const,
    queryFn: getQuranLastRead,
    staleTime: 0,
  });

  if (!data) return null;

  return (
    <View className="mt-8 mb-4 gap-3">
      <Text variant="label">{t("home.continueReading")}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/quran/${data.surah}`)}
      >
        <Card className="p-4">
          <Text variant="title">{data.surahName ?? `${t("home.surah")} ${data.surah}`}</Text>
          <Text variant="muted">{t("home.ayah", { number: data.ayahInSurah })}</Text>
        </Card>
      </Pressable>
    </View>
  );
}
