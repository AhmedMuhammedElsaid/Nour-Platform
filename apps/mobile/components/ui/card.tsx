import { View, type ViewProps } from "react-native";

import { cn } from "@/lib/cn";

export type CardProps = ViewProps & { className?: string };

export function Card({ className, ...props }: CardProps) {
  return (
    <View
      className={cn("overflow-hidden rounded-lg border border-border bg-surface", className)}
      {...props}
    />
  );
}
