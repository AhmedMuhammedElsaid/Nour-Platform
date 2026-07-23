import { buildArcSvg } from "@/features/prayer-times/widget/build-arc-svg";
import type { ArcDot } from "@/features/prayer-times/lib/arc-dots";

const DOTS: ArcDot[] = [
  { key: "fajr", fraction: 0, isNext: false },
  { key: "dhuhr", fraction: 0.4, isNext: true },
  { key: "asr", fraction: 0.6, isNext: false },
  { key: "maghrib", fraction: 1, isNext: false },
];

describe("buildArcSvg", () => {
  it("returns a self-contained svg string containing the arc path", () => {
    const svg = buildArcSvg({ dots: DOTS, fraction: 0.4, isNight: false, onNightBand: false });
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("M0 126"); // arcPath() start point
  });

  it("root svg carries explicit intrinsic size (not just viewBox)", () => {
    // Guards the AndroidSVG default-512×512-picture trap: SvgWidget.java
    // calls renderToPicture() with no dimensions, so without width/height
    // attrs on the root element the picture defaults to a 512×512 square.
    const svg = buildArcSvg({ dots: DOTS, fraction: 0.4, isNight: false, onNightBand: false });
    expect(svg).toContain('<svg width="600" height="150"');
  });

  it("day (sun) branch: no <mask>, has the sun disc + rays", () => {
    const svg = buildArcSvg({ dots: DOTS, fraction: 0.4, isNight: false, onNightBand: false });
    expect(svg).not.toContain("<mask");
    // 8 sun rays as <line> elements plus the horizon + gradient lines — just
    // assert the disc-radius circle for SUN_DISC (r="9") is present.
    expect(svg).toContain('r="9"');
  });

  it("night (moon) branch: has a <mask> crescent, no rayed sun disc", () => {
    const svg = buildArcSvg({ dots: DOTS, fraction: 0.9, isNight: true, onNightBand: true });
    expect(svg).toContain("<mask");
    expect(svg).toContain('mask="url(#moon-crescent)"');
  });

  it("night band draws the lowered second track only when onNightBand is true", () => {
    const withBand = buildArcSvg({ dots: DOTS, fraction: 0.9, isNight: true, onNightBand: true });
    const withoutBand = buildArcSvg({ dots: DOTS, fraction: 0.9, isNight: true, onNightBand: false });
    // The night-band path shares the day arc's control point (Q300 ...) but a
    // different (lowered) y — its presence is the differentiator: 2 "Q300 "
    // occurrences (day arc + night band) vs 1 (day arc only).
    const bandFragment = /Q300 /g;
    expect((withBand.match(bandFragment) ?? []).length).toBe(2);
    expect((withoutBand.match(bandFragment) ?? []).length).toBe(1);
  });

  it("emits exactly one <circle> per input dot, next dot uses the larger radius", () => {
    const svg = buildArcSvg({ dots: DOTS, fraction: 0.4, isNight: false, onNightBand: false });
    // Next dot: r="7"; the other 3 dots: r="3.5".
    const nextDotMatches = svg.match(/r="7" fill="#e4c57e"/g) ?? [];
    const plainDotMatches = svg.match(/r="3\.5"/g) ?? [];
    expect(nextDotMatches).toHaveLength(1);
    expect(plainDotMatches).toHaveLength(3);
  });

  it("never emits <filter> / <feGaussianBlur> — AndroidSVG silently drops them", () => {
    const dayS = buildArcSvg({ dots: DOTS, fraction: 0.4, isNight: false, onNightBand: false });
    const nightS = buildArcSvg({ dots: DOTS, fraction: 0.9, isNight: true, onNightBand: true });
    expect(dayS).not.toContain("<filter");
    expect(dayS).not.toContain("feGaussianBlur");
    expect(nightS).not.toContain("<filter");
    expect(nightS).not.toContain("feGaussianBlur");
  });
});
