import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";

// Themed in-app header (replaces React Navigation's default white header, which
// ignored the app palette and looked off in dark mode). Honours the status-bar
// safe area at the top and follows the theme via NativeWind tokens. Pass `onBack`
// for a back chevron; omit `title` when the screen shows its own in-content title
// (mirrors the Quran reader's header pattern).
export type ScreenHeaderProps = {
  title?: string;
  onBack?: () => void;
  backLabel?: string;
};

export function ScreenHeader({ title, onBack, backLabel }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View className="bg-bg px-2" style={{ paddingTop: insets.top + 8 }}>
      <View className="h-12 flex-row items-center gap-1">
        {onBack != null && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            onPress={onBack}
            className="size-10 items-center justify-center"
          >
            <Text className="text-3xl text-text">‹</Text>
          </Pressable>
        )}
        {title != null && (
          <Text variant="title" numberOfLines={1} className="flex-1">
            {title}
          </Text>
        )}
      </View>
    </View>
  );
}
