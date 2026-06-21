// Location picker — curated city list + "use my location" via expo-location.
// Mirrors apps/web/features/prayer-times/components/location-picker.tsx.

import { useState } from "react";
import { FlatList, Pressable, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import * as Location from "expo-location";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { CITIES, nearestCity, type City } from "../data/cities";
import type { PrayerLocation } from "@repo/shared-core/schemas/prayer-times";

type Props = {
  onSelect: (loc: PrayerLocation) => void;
  onClose: () => void;
};

export function LocationPicker({ onSelect, onClose }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = CITIES.filter((c) => {
    const q = query.toLowerCase();
    return c.en.toLowerCase().includes(q) || c.ar.includes(query);
  });

  const pick = (city: City) => {
    onSelect({ lat: city.lat, lng: city.lng, label: city.en, cityId: city.id });
    onClose();
  };

  const useMyLocation = async () => {
    setLocating(true);
    setError(null);
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        // Distinguish a hard block (must enable in Settings) from a simple
        // dismissal so the message tells the user how to recover.
        setError(canAskAgain ? t("prayer.locationUnavailable") : t("prayer.locationDeniedPerm"));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const city = nearestCity(pos.coords.latitude, pos.coords.longitude);
      onSelect({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: city.en, cityId: city.id });
      onClose();
    } catch {
      setError(t("prayer.locationUnavailable"));
    } finally {
      setLocating(false);
    }
  };

  return (
    <View className="flex-1 gap-4 px-4 py-4">
      <Text variant="display" className="text-xl">
        {t("prayer.changeCity")}
      </Text>

      <Button
        label={locating ? t("prayer.locating") : t("prayer.useMyLocation")}
        variant="outline"
        disabled={locating}
        onPress={() => void useMyLocation()}
      />

      {error != null && <Text className="text-danger text-sm">{error}</Text>}

      <TextInput
        placeholder={t("prayer.searchCity")}
        placeholderTextColor="#7a6a52"
        value={query}
        onChangeText={setQuery}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-text"
        accessibilityLabel={t("prayer.searchCity")}
      />

      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        contentContainerClassName="gap-1 pb-8"
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => pick(item)}>
            <View className="flex-row items-center justify-between rounded-lg bg-surface px-4 py-3">
              <Text variant="body">{item.en}</Text>
              <Text variant="muted">{item.ar}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
