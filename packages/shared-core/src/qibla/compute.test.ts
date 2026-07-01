import { describe, expect, it } from "vitest";

import {
  computeQiblaBearing,
  KAABA,
  qiblaCardinalKey,
  qiblaDistanceKm,
} from "./compute";

// Authoritative Qibla bearings (degrees from true north), cross-checked against
// well-known qibla references. Tolerance ±1° absorbs coordinate rounding.
const REFERENCE: Array<{ city: string; lat: number; lng: number; bearing: number }> = [
  { city: "Cairo", lat: 30.0444, lng: 31.2357, bearing: 136 },
  { city: "London", lat: 51.5074, lng: -0.1278, bearing: 119 },
  { city: "New York", lat: 40.7128, lng: -74.006, bearing: 58 },
  { city: "Jakarta", lat: -6.2088, lng: 106.8456, bearing: 295 },
];

describe("computeQiblaBearing", () => {
  for (const { city, lat, lng, bearing } of REFERENCE) {
    it(`${city} points ~${bearing}° to the Kaaba`, () => {
      expect(computeQiblaBearing({ lat, lng })).toBeCloseTo(bearing, 0);
    });
  }

  it("always returns a value in [0, 360)", () => {
    for (const { lat, lng } of REFERENCE) {
      const b = computeQiblaBearing({ lat, lng });
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(360);
    }
  });

  it("returns a finite number at the Kaaba itself", () => {
    expect(Number.isFinite(computeQiblaBearing({ ...KAABA }))).toBe(true);
  });
});

describe("qiblaCardinalKey", () => {
  it("maps bearings to the nearest 8-point compass key", () => {
    expect(qiblaCardinalKey(0)).toBe("n");
    expect(qiblaCardinalKey(45)).toBe("ne");
    expect(qiblaCardinalKey(90)).toBe("e");
    expect(qiblaCardinalKey(136)).toBe("se");
    expect(qiblaCardinalKey(180)).toBe("s");
    expect(qiblaCardinalKey(225)).toBe("sw");
    expect(qiblaCardinalKey(270)).toBe("w");
    expect(qiblaCardinalKey(315)).toBe("nw");
    expect(qiblaCardinalKey(359)).toBe("n"); // wraps back to north
  });
});

describe("qiblaDistanceKm", () => {
  it("is ~zero at the Kaaba and grows with distance", () => {
    expect(qiblaDistanceKm({ ...KAABA })).toBeCloseTo(0, 0);
    // Cairo → Mecca is roughly 1250 km.
    expect(qiblaDistanceKm({ lat: 30.0444, lng: 31.2357 })).toBeGreaterThan(1100);
    expect(qiblaDistanceKm({ lat: 30.0444, lng: 31.2357 })).toBeLessThan(1400);
  });
});
