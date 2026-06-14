// Computes the bottom padding a scrollable screen needs so its content never
// hides behind the bottom dock (BottomTabBar + MiniPlayer, see
// components/bottom-dock.tsx). The tab bar is always shown and carries the
// safe-area inset; the mini-player stacks above it when a queue is loaded.

import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePlayer } from "@/lib/player-context";

// Approximate rendered heights (icon/text rows + paddings) from
// bottom-tab-bar.tsx and mini-player.tsx.
const TAB_BAR_HEIGHT = 64;
const MINI_PLAYER_HEIGHT = 72;
// Extra breathing room below the last item, independent of the dock.
const BASE_GAP = 16;

export function useDockSpacing(): number {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { hasQueue } = usePlayer();

  // The full-screen player owns its own layout — no dock is rendered there.
  if (pathname === "/player") return BASE_GAP;

  let dock = TAB_BAR_HEIGHT + insets.bottom;
  if (hasQueue) dock += MINI_PLAYER_HEIGHT;

  return dock + BASE_GAP;
}
