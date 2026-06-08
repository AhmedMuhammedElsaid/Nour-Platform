import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Chip } from "@/components/ui/chip";

export type SortOption = "newest" | "az" | "tracks";
export const SORT_OPTIONS: readonly SortOption[] = ["newest", "az", "tracks"];

export type SortSelectProps = {
  value: SortOption;
  onChange: (value: SortOption) => void;
};

export function SortSelect({ value, onChange }: SortSelectProps) {
  const { t } = useTranslation();
  return (
    <View className="flex-row gap-2">
      {SORT_OPTIONS.map((opt) => (
        <Chip
          key={opt}
          label={t(`home.sort.${opt}`)}
          active={value === opt}
          onPress={() => onChange(opt)}
        />
      ))}
    </View>
  );
}
