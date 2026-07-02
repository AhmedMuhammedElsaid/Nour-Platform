import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Image, Pressable, ScrollView, View } from "react-native";

import type { QuranReciter } from "@repo/shared-core/schemas/quran";
import { reciterGradient, reciterInitials } from "@repo/shared-core/quran/reciter-avatar";

import { Text } from "@/components/ui/text";
import { assetUrl } from "@/lib/api";
import { getQuranPrefs, setQuranPrefs } from "@/lib/device-local";
import { initialLocale } from "@/lib/i18n";
import { quranRecitersQuery } from "@/lib/queries";

// Home "Readers" shelf — a horizontal row of Quran reciters. Tapping a reader
// sets it as the active reader voice (nour.quran.prefs) and opens the Quran, so
// any surah opened afterward recites in that voice. Mirrors the web ReadersShelf
// and the mobile continue-listening shelf.
export function RecitersShelf() {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = initialLocale;
  const { data } = useQuery(quranRecitersQuery());

  // Guard the always-visible home surface: drop any row without a usable slug/name
  // so a malformed API response can never white-screen the whole screen (a reciter
  // with no slug is unselectable anyway).
  const reciters = (data ?? []).filter(
    (r) => typeof r.slug === "string" && r.slug.length > 0 && typeof r.name === "string",
  );
  if (reciters.length === 0) return null;

  const selectReader = async (slug: string): Promise<void> => {
    const prefs = await getQuranPrefs();
    await setQuranPrefs({ ...prefs, reciterSlug: slug });
    router.push("/quran");
  };

  return (
    <View className="mt-8 gap-3">
      <Text variant="label">{t("home.reciters")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-4">
        {reciters.map((reciter) => {
          const displayName =
            locale === "ar" && reciter.arabicName ? reciter.arabicName : reciter.name;
          return (
            <Pressable
              key={reciter.slug}
              accessibilityRole="button"
              accessibilityLabel={displayName}
              className="w-24 items-center gap-2"
              onPress={() => void selectReader(reciter.slug)}
            >
              <ReaderAvatar reciter={reciter} />
              <Text variant="body" numberOfLines={2} className="text-center text-xs">
                {displayName}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Circular avatar: the reciter photo when present, else a deterministic solid
// tint + initials fallback. RN has no gradient primitive, so we use the gradient's
// top stop as a solid fill (same approach as the playlists Cover). `onError`
// degrades a set-but-missing image to the same fallback.
function ReaderAvatar({ reciter }: { reciter: QuranReciter }) {
  const [broken, setBroken] = useState(false);
  const [from] = reciterGradient(reciter.slug);

  if (reciter.image && !broken) {
    return (
      <Image
        source={{ uri: assetUrl(reciter.image) }}
        className="h-20 w-20 rounded-full"
        resizeMode="cover"
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <View
      className="h-20 w-20 items-center justify-center rounded-full"
      style={{ backgroundColor: from }}
    >
      <Text className="text-lg font-semibold text-white">{reciterInitials(reciter.name)}</Text>
    </View>
  );
}
