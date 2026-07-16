import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";

import type { Azkar } from "@repo/shared-core/schemas/azkar";
import { ADHKAR_PREVIEW_COUNT, previewAdhkarIcon } from "@repo/shared-core/adhkar/preview";

import { Text } from "@/components/ui/text";
import { initialLocale } from "@/lib/i18n";
import { adhkarListQuery } from "@/lib/queries";

// Home "Adhkar" shelf — a short preview of the /adhkar catalog (first
// ADHKAR_PREVIEW_COUNT sets, curated via seed order — see scripts/seed-adhkar.ts).
// Minimal cards (icon + title, no progress bar). Mirrors web AdhkarPreviewShelf
// and the Radio/Readers shelves already on Home.
export function AdhkarPreviewShelf() {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = initialLocale;
  const { data } = useQuery(adhkarListQuery());

  const preview = ((data ?? []) as Azkar[]).slice(0, ADHKAR_PREVIEW_COUNT);
  if (preview.length === 0) return null;

  return (
    <View className="mt-8 gap-3">
      <View className="flex-row items-center justify-between">
        <Text variant="label">{t("home.adhkar")}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/adhkar")}
          hitSlop={8}
          className="flex-row items-center gap-1"
        >
          <Text className="text-sm text-muted">{t("home.adhkarExplore")}</Text>
          <Text className="text-sm text-muted">›</Text>
        </Pressable>
      </View>

      <View className="flex-row flex-wrap gap-3">
        {preview.map((set, index) => {
          const display = set[locale] ?? set.ar;
          return (
            <View key={set.id} className="w-[48%]">
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/adhkar/${encodeURIComponent(display.slug)}`)}
                className="items-center gap-2 rounded-2xl border border-border bg-surface p-4"
              >
                <View className="size-12 items-center justify-center rounded-xl bg-primary/10">
                  <Text className="text-2xl">{previewAdhkarIcon(index)}</Text>
                </View>
                <Text variant="body" numberOfLines={2} className="text-center text-sm font-medium">
                  {display.title}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
