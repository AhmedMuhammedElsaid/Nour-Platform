import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/lib/theme-context";

export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("settings.toggleTheme")}
      onPress={toggleTheme}
      className="p-2"
    >
      <Text className="text-xl">{theme === "dark" ? "☀" : "☾"}</Text>
    </Pressable>
  );
}
