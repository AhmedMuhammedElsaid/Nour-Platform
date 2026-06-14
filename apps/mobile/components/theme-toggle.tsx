import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";

import { MoonIcon, SunIcon } from "@/components/icons/theme-icons";
import { useTheme } from "@/lib/theme-context";

export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  // Stroke uses the resolved text color so the icon reads on either bg (no pill).
  // Dark mode offers the sun (tap → light); light mode offers the moon (tap → dark).
  const color = theme === "dark" ? "#f0e6cc" : "#13201a";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("settings.toggleTheme")}
      onPress={toggleTheme}
      className="p-2"
    >
      {theme === "dark" ? (
        <SunIcon color={color} size={22} testID="theme-icon-sun" />
      ) : (
        <MoonIcon color={color} size={22} testID="theme-icon-moon" />
      )}
    </Pressable>
  );
}
