import { View } from "react-native";

import { cn } from "@/lib/cn";

export type SkeletonProps = {
  className?: string;
};

// A dimmed placeholder block. Width/height come from `className`
// (e.g. "h-4 w-24"). Used by the loading states of Home and Playlist Detail.
// Kept animation-free so it has no running timers (test-friendly); a shimmer
// can be layered on in the Phase 10 polish pass.
export function Skeleton({ className }: SkeletonProps) {
  return (
    <View
      accessibilityRole="progressbar"
      className={cn("rounded-md bg-surface-2 opacity-60", className)}
    />
  );
}
