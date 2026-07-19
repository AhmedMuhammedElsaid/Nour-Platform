// Mushaf page-turn swipe gesture — pure direction resolution, kept separate
// from the PanResponder wiring in reader.tsx so it's unit-testable without
// simulating native gesture events (see __tests__/swipe.test.ts).
//
// Directionality is a hard requirement, not a style choice: a left-to-right
// drag (finger starts left, moves right — positive dx) means FORWARD (next
// page); a right-to-left drag (negative dx) means BACKWARD (prev page). This
// is fixed regardless of RTL/LTR locale — Mushaf page order follows the
// physical swipe, not text direction.
export const MUSHAF_SWIPE_THRESHOLD = 32;

export type SwipeDirection = "forward" | "backward";

// Only resolves a direction for a gesture that's clearly horizontal (bigger
// dx than dy) and has traveled past `threshold` px — anything else (a
// vertical scroll, or a short accidental drag) returns null so the caller
// leaves the current page alone.
export function resolveSwipeDirection(
  dx: number,
  dy: number,
  threshold: number = MUSHAF_SWIPE_THRESHOLD,
): SwipeDirection | null {
  if (Math.abs(dx) <= Math.abs(dy)) return null;
  if (Math.abs(dx) < threshold) return null;
  return dx > 0 ? "forward" : "backward";
}
