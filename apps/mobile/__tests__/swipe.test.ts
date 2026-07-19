import { resolveSwipeDirection } from "@/features/quran/lib/swipe";

describe("resolveSwipeDirection", () => {
  it("resolves a left-to-right drag (positive dx) past the threshold as forward", () => {
    expect(resolveSwipeDirection(50, 0, 32)).toBe("forward");
  });

  it("resolves a right-to-left drag (negative dx) past the threshold as backward", () => {
    expect(resolveSwipeDirection(-50, 0, 32)).toBe("backward");
  });

  it("returns null when dx hasn't crossed the threshold yet", () => {
    expect(resolveSwipeDirection(10, 0, 32)).toBeNull();
    expect(resolveSwipeDirection(-10, 0, 32)).toBeNull();
  });

  it("returns null when the drag is more vertical than horizontal (a scroll, not a swipe)", () => {
    expect(resolveSwipeDirection(40, 60, 32)).toBeNull();
    expect(resolveSwipeDirection(-40, 60, 32)).toBeNull();
  });

  it("returns null on a diagonal drag where dx and dy are equal", () => {
    expect(resolveSwipeDirection(40, 40, 32)).toBeNull();
  });

  it("uses the default threshold when none is passed", () => {
    expect(resolveSwipeDirection(100, 0)).toBe("forward");
    expect(resolveSwipeDirection(5, 0)).toBeNull();
  });
});
