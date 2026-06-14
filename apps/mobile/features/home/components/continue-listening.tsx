import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";

import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { Cover } from "@/features/playlists/components/cover";
import { readRecentlyPlayed } from "@/lib/device-local";

// Device-local shelf. The writer (audio engine) lands in Phase 6; until then
// the read returns empty and the shelf renders nothing.
export function ContinueListening() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data } = useQuery({
    queryKey: ["recently-played"] as const,
    queryFn: readRecentlyPlayed,
    staleTime: 0,
  });

  const items = data ?? [];
  if (items.length === 0) return null;

  return (
    <View className="mt-8 gap-3">
      <Text variant="label">{t("home.continueListening")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
        {items.map((item) => (
          <Pressable
            key={item.trackId}
            accessibilityRole="button"
            className="w-36"
            onPress={() =>
              item.playlistSlug != null &&
              router.push(
                `/playlist/${encodeURIComponent(item.playlistSlug)}?trackId=${encodeURIComponent(item.trackId)}`,
              )
            }
          >
            <Card>
              <Cover id={item.trackId} className="aspect-square w-full" />
              <View className="p-2">
                <Text variant="body" numberOfLines={1}>
                  {item.title}
                </Text>
                {item.playlistTitle != null && (
                  <Text variant="muted" numberOfLines={1}>
                    {item.playlistTitle}
                  </Text>
                )}
              </View>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
