// iOS-only foreground adhan stop control — Android gets an equivalent "Stop"
// action on the native AdhanPlayerService notification instead (see
// use-foreground-adhan.ts). Floats above the current screen while the adhan
// plays; self-gates on `activeKey === null`.

import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { AdhanPrayerKey } from "@repo/shared-core/schemas/prayer-times";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

export function AdhanStopCard({
  activeKey,
  onStop,
}: {
  activeKey: AdhanPrayerKey | null;
  onStop: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  if (activeKey == null) return null;

  return (
    <View
      accessibilityRole="alert"
      className="flex-row items-center gap-3 rounded-2xl border border-primary/40 bg-surface p-4 shadow-lg"
      style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16, zIndex: 70 }}
    >
      <View className="flex-1">
        <Text variant="title">{t(`prayer.${activeKey}`)}</Text>
        <Text variant="muted" className="mt-0.5 text-sm">
          {t("prayer.adhan.adhanBody")}
        </Text>
      </View>
      <Button label={t("prayer.adhan.stop")} size="sm" variant="secondary" onPress={onStop} />
    </View>
  );
}
