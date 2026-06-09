import { View } from "react-native";

import { cn } from "@/lib/cn";

export type ProgressProps = {
  value: number; // 0–100
  className?: string;
};

export function Progress({ value, className }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      className={cn("h-2 overflow-hidden rounded-full bg-surface-2", className)}
    >
      <View className="h-full rounded-full bg-primary" style={{ width: `${clamped}%` }} />
    </View>
  );
}
