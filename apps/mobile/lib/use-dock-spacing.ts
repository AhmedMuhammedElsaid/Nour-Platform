// Computes the bottom padding a scrollable screen needs so its content never
// hides behind the bottom dock (BottomTabBar + MiniPlayer, see
// components/bottom-dock.tsx). Both elements stack above the safe-area inset,
// so the padding must account for whichever combination is currently showing.

import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { isTabRoot } from "@/components/bottom-tab-bar";
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
  const showTabBar = isTabRoot(pathname);

  let dock = 0;
  if (showTabBar) dock += TAB_BAR_HEIGHT + insets.bottom;
  if (hasQueue) dock += MINI_PLAYER_HEIGHT + (showTabBar ? 0 : insets.bottom);

  return dock + BASE_GAP;
}
