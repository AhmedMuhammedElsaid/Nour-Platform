import { describe, expect, it } from "vitest";

import { ARC, arcPath, arcPoint, tForFraction } from "./sun-arc";

describe("arcPoint", () => {
  it("returns the left endpoint at t=0 and right endpoint at t=1", () => {
    expect(arcPoint(0)).toEqual({ x: ARC.p0.x, y: ARC.p0.y });
    expect(arcPoint(1)).toEqual({ x: ARC.p2.x, y: ARC.p2.y });
  });
  it("peaks above the baseline near the middle", () => {
    expect(arcPoint(0.5).y).toBeLessThan(ARC.p0.y);
  });
});

describe("tForFraction", () => {
  it("insets the [0,1] day fraction so dots stay off the edges", () => {
    expect(tForFraction(0)).toBeGreaterThan(0);
    expect(tForFraction(1)).toBeLessThan(1);
    expect(tForFraction(0.5)).toBeCloseTo(0.5, 5);
  });
});

describe("arcPath", () => {
  it("is a quadratic Bezier string using the ARC control points", () => {
    expect(arcPath()).toBe(
      `M${ARC.p0.x} ${ARC.p0.y} Q${ARC.p1.x} ${ARC.p1.y} ${ARC.p2.x} ${ARC.p2.y}`,
    );
  });
});
