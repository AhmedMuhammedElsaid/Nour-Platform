import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

export type ReaderTab = "surah" | "juz";

// RN port of apps/web/features/quran/components/surah-juz-tabs.tsx. The Juz
// list is a v1.1 placeholder (the /quran/juz endpoint isn't built yet), so the
// tab strip just toggles which body the parent screen renders.
export function SurahJuzTabs({ tab, onChange }: { tab: ReaderTab; onChange: (t: ReaderTab) => void }) {
  const { t } = useTranslation();
  const tabs: { id: ReaderTab; label: string }[] = [
    { id: "surah", label: t("quran.surah") },
    { id: "juz", label: t("quran.juz") },
  ];
  return (
    <View className="mb-4 flex-row gap-2 border-b border-border">
      {tabs.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === item.id }}
          onPress={() => onChange(item.id)}
          className={cn("px-4 py-2", tab === item.id && "border-b-2 border-primary")}
        >
          <Text className={cn("text-sm", tab === item.id ? "text-primary" : "text-text-2")}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
