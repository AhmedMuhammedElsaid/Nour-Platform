// Bottom dock — stacks the MiniPlayer directly above the BottomTabBar
// (SoundCloud-style) on every route and owns the home-indicator safe-area
// inset, which the tab bar (always bottom-most) carries. Rendered once in the
// root layout. The mini-player self-gates on an empty queue.

import { Fragment } from "react";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomTabBar } from "@/components/bottom-tab-bar";
import { MiniPlayer } from "@/components/mini-player";

export function BottomDock() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  // The full-screen player already owns the transport — don't stack the dock
  // (mini-player + tab bar) over it.
  if (pathname === "/player") return null;

  return (
    <Fragment>
      <MiniPlayer bottomInset={0} />
      <BottomTabBar bottomInset={insets.bottom} />
    </Fragment>
  );
}
