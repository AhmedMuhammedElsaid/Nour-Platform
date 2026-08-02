// Bottom clearance for a scrollable screen's last item, so it isn't rendered
// behind the bottom dock (tab bar, plus the mini-player when a queue is
// loaded).
//
// Earlier versions of this hook returned a flat 8dp on the theory that the
// dock is a flex sibling of <Stack/> in app/_layout.tsx (no `position:
// "absolute"` anywhere), so the Stack's own flex:1 area is already sized to
// exclude the dock's full rendered height — a screen's content could "never"
// render behind it. That premise did not hold up on-device: prayer-times and
// the Quran index both needed a local `useDockSpacing() + 88` patch
// (2026-07-31, see APP_CONTEXT "bottom-dock overlap") to actually clear the
// tab bar, and the owner then reported the SAME failure mode on the Adhkar
// screens and Downloads, which never got that patch. Rather than add a fourth
// ad-hoc `+88`, this now computes the dock's real height from the two
// components that make it up, so there is exactly one formula.
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_HEIGHT } from "@/components/bottom-tab-bar";
import { MINI_PLAYER_HEIGHT } from "@/components/mini-player";
import { usePlayerHasQueue } from "@/lib/player-context";

// Small extra breathing room below the dock's own bottom edge.
const BASE_GAP = 8;

export function useDockSpacing(): number {
  const insets = useSafeAreaInsets();
  // usePlayerHasQueue() is a dedicated boolean context (see player-context.tsx)
  // rather than usePlayerTransport().hasQueue, which also changes on every
  // play/pause and track advance — this hook must not re-render for those.
  const hasQueue = usePlayerHasQueue();

  return (
    BASE_GAP +
    TAB_BAR_HEIGHT +
    insets.bottom +
    (hasQueue ? MINI_PLAYER_HEIGHT : 0)
  );
}
