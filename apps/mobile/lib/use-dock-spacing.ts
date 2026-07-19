// Small breathing room below a scrollable screen's last item.
//
// The bottom dock (BottomTabBar + MiniPlayer, see components/bottom-dock.tsx)
// is NOT an overlay — confirmed from its original introduction (`31767dd`)
// onward, it has always been a plain sibling of <Stack/> in app/_layout.tsx's
// flex-column tree, with no `position: "absolute"` anywhere. That means the
// Stack navigator (and therefore every screen's own flex:1 area) is ALREADY
// sized by flexbox to exclude the dock's full rendered height, tab bar +
// mini-player + their own safe-area padding included — a screen's content
// can never render behind it. A previous version of this hook re-added the
// dock's height (TAB_BAR_HEIGHT + MINI_PLAYER_HEIGHT + insets.bottom) on top
// of that, which just double-reserved the same space twice, showing up as a
// large empty gap between a screen's last item and the dock (reported
// 2026-07-20). Kept as a hook (not inlined per call site) so a future screen
// that genuinely needs extra clearance has one place to add it back.
const BASE_GAP = 8;

export function useDockSpacing(): number {
  return BASE_GAP;
}
