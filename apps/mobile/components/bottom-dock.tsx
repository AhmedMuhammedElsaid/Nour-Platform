// Bottom dock — stacks the MiniPlayer directly above the BottomTabBar
// (SoundCloud-style) and owns the home-indicator safe-area inset, routing it to
// whichever element is bottom-most: the tab bar on a tab root, otherwise the
// mini-player on a detail screen (where the bar is hidden). Rendered once in the
// root layout. Each child still self-gates (the mini-player hides with no queue;
// the bar is mounted only on tab roots), so nothing renders when both are empty.

import { Fragment } from "react";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomTabBar, isTabRoot } from "@/components/bottom-tab-bar";
import { MiniPlayer } from "@/components/mini-player";

export function BottomDock() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const showTabBar = isTabRoot(pathname);

  // The full-screen player already owns the transport — don't stack the dock
  // (mini-player + tab bar) over it.
  if (pathname === "/player") return null;

  return (
    <Fragment>
      {/* When the bar is visible it is bottom-most and carries the inset; the
          mini-player then needs none. On detail screens the mini-player is
          bottom-most and carries the inset itself. */}
      <MiniPlayer bottomInset={showTabBar ? 0 : insets.bottom} />
      {showTabBar && <BottomTabBar bottomInset={insets.bottom} />}
    </Fragment>
  );
}
