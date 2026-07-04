// Computes the bottom padding a scrollable screen needs so its content never
// hides behind the bottom dock (BottomTabBar + MiniPlayer, see
// components/bottom-dock.tsx). The tab bar is always shown and carries the
// safe-area inset; the mini-player stacks above it when a queue is loaded.

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePlayer } from "@/lib/player-context";

// Rendered heights (icon/text rows + paddings) from bottom-tab-bar.tsx and
// mini-player.tsx — trimmed to the actual content height (the dock is an opaque
// overlay, so content only needs to clear it, not float well above it).
const TAB_BAR_HEIGHT = 52;
const MINI_PLAYER_HEIGHT = 60;
// Small breathing room below the last item, independent of the dock.
const BASE_GAP = 8;

// NOTE: deliberately does NOT read usePathname(). Every screen that calls this
// hook stays MOUNTED in the expo-router stack, so subscribing to the pathname
// re-rendered all of them on every navigation (JS-thread storm → janky tab
// switches). The only thing the path was used for was collapsing the pad on the
// /player modal — but this hook is never called there, and those background
// screens are invisible behind the full-screen modal, so the pad is moot.
export function useDockSpacing(): number {
  const insets = useSafeAreaInsets();
  const { hasQueue } = usePlayer();

  let dock = TAB_BAR_HEIGHT + insets.bottom;
  if (hasQueue) dock += MINI_PLAYER_HEIGHT;

  return dock + BASE_GAP;
}
