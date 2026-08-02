// Bottom clearance for a scrollable screen's last item, so it isn't rendered
// behind the bottom dock (tab bar, plus the mini-player when a queue is
// loaded).
//
// History: this hook has now gone flat(8dp) → real-dock-height(~150-190dp) →
// back to flat+insets. The real-dock-height version (TAB_BAR_HEIGHT +
// MINI_PLAYER_HEIGHT, added 2026-08-02) was reasoned from historical device
// reports that a flat 8dp let content render behind the dock — but shipping
// it produced an owner-reported LARGE empty gap on every tab, worst whenever
// a queue was loaded (i.e. the exact condition that added MINI_PLAYER_HEIGHT
// to the sum). That means the dock — a flex sibling of <Stack/> in
// app/_layout.tsx, not an absolutely-positioned overlay — likely DOES
// already shrink the Stack's own flex:1 area by its real rendered height,
// same as any two ordinary flex siblings; explicitly re-adding that height
// as padding double-reserved it. The earlier "content hidden behind the
// dock" reports were most likely fixed by wrapping bare-Fragment screens in
// a proper `<View className="flex-1 bg-bg">` (see APP_CONTEXT "bottom-dock
// overlap") — a real, separate, already-shipped fix — not by the padding
// amount, and the various `+N` patches piled on after that were probably
// redundant safety margin nobody re-measured.
//
// If a last-item-hidden-behind-the-dock report comes back, the fix is almost
// certainly still a missing wrap on that specific screen, not a bigger
// number here. Re-derive a real per-component figure only against fresh
// on-device evidence, not from first-principles Yoga reasoning — this file's
// whole history is a lesson in how unreliable that reasoning has been.
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BASE_GAP = 16;

export function useDockSpacing(): number {
  const insets = useSafeAreaInsets();
  return BASE_GAP + insets.bottom;
}
