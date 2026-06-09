// Calculation method + madhab pickers.

import { ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { Chip } from "@/components/ui/chip";
import {
  CALCULATION_METHOD_IDS,
  type CalculationMethodId,
  type MadhabId,
} from "@repo/shared-core/schemas/prayer-times";

type Props = {
  method: CalculationMethodId;
  madhab: MadhabId;
  onMethodChange: (m: CalculationMethodId) => void;
  onMadhabChange: (m: MadhabId) => void;
};

export function MethodSettings({ method, madhab, onMethodChange, onMadhabChange }: Props) {
  const { t } = useTranslation();

  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text variant="label">{t("prayer.calculation")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2 py-1">
            {CALCULATION_METHOD_IDS.map((id) => (
              <Chip
                key={id}
                label={t(`prayer.method${id}` as `prayer.method${string}`)}
                active={method === id}
                onPress={() => onMethodChange(id)}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      <View className="gap-2">
        <Text variant="label">{t("prayer.madhab")}</Text>
        <View className="flex-row gap-2">
          {(["standard", "hanafi"] as const).map((m) => (
            <Chip
              key={m}
              label={t(m === "standard" ? "prayer.madhabStandard" : "prayer.madhabHanafi")}
              active={madhab === m}
              onPress={() => onMadhabChange(m)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
