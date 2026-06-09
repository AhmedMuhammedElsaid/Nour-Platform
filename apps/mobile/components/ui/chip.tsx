import { Pressable, Text, View } from "react-native";

import { cn } from "@/lib/cn";

export type ChipProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  className?: string;
};

// A small rounded label. Interactive when `onPress` is provided (category
// pills), otherwise a static badge (card category chips).
export function Chip({ label, active = false, onPress, className }: ChipProps) {
  const container = cn(
    "rounded-full border px-3 py-1",
    active ? "border-primary bg-primary/15" : "border-border bg-transparent",
    className,
  );
  const text = cn("text-xs", active ? "text-primary" : "text-text-2");

  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} className={container}>
        <Text className={text}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <View className={container}>
      <Text className={text}>{label}</Text>
    </View>
  );
}
