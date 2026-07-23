// SVG-string builder for the OS home-screen widget's sun/moon arc
// (home_widget_plan.md §2). RNAW's <SvgWidget> hands a raw SVG string to the
// native AndroidSVG renderer — the in-app <SunArc> is react-native-svg JSX
// and cannot be reused directly, so this generates an equivalent string from
// the same pure geometry (@repo/shared-core/prayer-times/sun-arc) and the
// same palette/sizing constants as
// features/prayer-times/components/sun-arc.tsx.
//
// ⚠️ AndroidSVG (caverock 1.4) supports paths, linearGradient, radialGradient,
// and mask, but SILENTLY DROPS <filter>/<feGaussianBlur> — so unlike the
// in-app arc's Gaussian-blur bloom, the glow here is approximated with
// stacked semi-transparent radialGradient halo circles (owner-approved, see
// plan §Decisions). There is also no animation (static bitmap) — the
// reanimated corona pulse is dropped.
//
// Dark-theme hexes only (widget is dark-only for v1) — mirrored from
// PALETTES.dark in sun-arc.tsx, itself mirroring
// packages/ui/src/styles/tokens.css (sanctioned inline-hex exception; a
// widget bitmap has no Tailwind/CSS pipeline to draw tokens from).

import { ARC, arcPath, arcPoint, tForFraction } from "@repo/shared-core/prayer-times/sun-arc";

import type { ArcDot } from "@/features/prayer-times/lib/arc-dots";

const GOLD = "#c8a050"; // --color-primary
const SUN = "#e4c57e"; // --color-sun
const MOON = "#d6e3ff"; // --color-moon
const MUTED = "#8a7a62"; // --color-text-2

// Body sizes — same values as sun-arc.tsx's phone-legible constants.
const SUN_DISC = 9;
const SUN_CORE = 11;
const SUN_CORONA = 28;
const SUN_RAY_INNER = 14;
const SUN_RAY_OUTER = 20;
const MOON_DISC = 12;
const MOON_CORONA = 30;
const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

// The night track is the day arc scaled toward the horizon — same derivation
// as sun-arc.tsx's NIGHT_BAND/lowerToBand (shared-core owns only the base arc
// geometry; the band lives with each renderer).
const NIGHT_BAND = 0.34;
const lowerToBand = (y: number) => ARC.p0.y - (ARC.p0.y - y) * NIGHT_BAND;

export type BuildArcSvgInput = {
  dots: ArcDot[];
  // 0..1 progress of the active body (see getArcPosition).
  fraction: number;
  // True before Fajr / at-or-after Isha — draw the crescent moon instead of
  // the sun.
  isNight: boolean;
  // True only on the lower night band (Isha→dawn) — draws the second/lower
  // arc track and drops the body onto it.
  onNightBand: boolean;
};

export function buildArcSvg({ dots, fraction, isNight, onNightBand }: BuildArcSvgInput): string {
  const point = arcPoint(tForFraction(fraction));
  const body = onNightBand ? { x: point.x, y: lowerToBand(point.y) } : point;
  const nightBandPath = `M${ARC.p0.x} ${ARC.p0.y} Q${ARC.p1.x} ${lowerToBand(ARC.p1.y)} ${ARC.p2.x} ${ARC.p2.y}`;

  const dotEls = dots.map((dot) => buildDot(dot)).join("");
  const bodyEls = isNight ? buildMoon(body) : buildSun(body);

  return [
    // Explicit width/height (not just viewBox): RNAW's native SvgWidget.java
    // calls AndroidSVG's `svg.renderToPicture()` with no dimensions —
    // AndroidSVG then sizes the picture from the SVG root's width/height
    // attrs, defaulting to 512×512 when they're absent. Without them, our
    // 600×150 viewBox gets aspect-fit into that 512×512 square, and the
    // widget's ImageView (FIT_CENTER) fits the square into the wide/short arc
    // slot — rendering the arc as a ~25%-width smudge. Explicit intrinsic
    // size makes the picture itself 600×150, so FIT_CENTER fills the slot's
    // full width.
    `<svg width="${ARC.w}" height="${ARC.h}" viewBox="0 0 ${ARC.w} ${ARC.h}" xmlns="http://www.w3.org/2000/svg">`,
    "<defs>",
    `<linearGradient id="arc-grad" x1="0" y1="0" x2="1" y2="0">`,
    `<stop offset="0" stop-color="${GOLD}" stop-opacity="0.15" />`,
    `<stop offset="0.5" stop-color="${SUN}" stop-opacity="1" />`,
    `<stop offset="1" stop-color="${GOLD}" stop-opacity="0.15" />`,
    "</linearGradient>",
    buildGlowGradient("sun-glow-outer", SUN, 0.35),
    buildGlowGradient("sun-glow-inner", SUN, 0.55),
    buildGlowGradient("moon-glow-outer", MOON, 0.3),
    buildGlowGradient("moon-glow-inner", MOON, 0.5),
    isNight ? buildCrescentMask(body) : "",
    "</defs>",
    `<line x1="0" y1="${ARC.p0.y}" x2="${ARC.w}" y2="${ARC.p0.y}" stroke="${GOLD}" stroke-opacity="0.14" />`,
    `<path d="${arcPath()}" fill="none" stroke="url(#arc-grad)" stroke-width="2" stroke-dasharray="2 7" />`,
    onNightBand
      ? `<path d="${nightBandPath}" fill="none" stroke="${MOON}" stroke-width="2" stroke-opacity="0.22" stroke-dasharray="2 7" />`
      : "",
    dotEls,
    bodyEls,
    "</svg>",
  ].join("");
}

function buildGlowGradient(id: string, color: string, centerOpacity: number): string {
  return [
    `<radialGradient id="${id}" cx="50%" cy="50%" r="50%">`,
    `<stop offset="0" stop-color="${color}" stop-opacity="${centerOpacity}" />`,
    `<stop offset="1" stop-color="${color}" stop-opacity="0" />`,
    "</radialGradient>",
  ].join("");
}

function buildCrescentMask(body: { x: number; y: number }): string {
  // Subtract an offset disc from the moon disc — same absolute-coordinate
  // recipe as sun-arc.tsx:168-171 (no transforms in this SVG, so the mask
  // always aligns).
  return [
    `<mask id="moon-crescent">`,
    `<circle cx="${body.x}" cy="${body.y}" r="${MOON_DISC}" fill="white" />`,
    `<circle cx="${body.x + 4.5}" cy="${body.y - 2.5}" r="${MOON_DISC - 1}" fill="black" />`,
    "</mask>",
  ].join("");
}

function buildDot(dot: ArcDot): string {
  const pt = arcPoint(tForFraction(dot.fraction));
  if (dot.isNext) {
    return `<circle cx="${pt.x}" cy="${pt.y}" r="7" fill="${SUN}" stroke="${SUN}" stroke-opacity="0.32" stroke-width="3" />`;
  }
  return `<circle cx="${pt.x}" cy="${pt.y}" r="3.5" fill="${MUTED}" opacity="0.7" />`;
}

function buildSun(body: { x: number; y: number }): string {
  const rays = RAY_ANGLES.map((angle) => {
    const rad = (angle * Math.PI) / 180;
    const x1 = body.x + Math.cos(rad) * SUN_RAY_INNER;
    const y1 = body.y + Math.sin(rad) * SUN_RAY_INNER;
    const x2 = body.x + Math.cos(rad) * SUN_RAY_OUTER;
    const y2 = body.y + Math.sin(rad) * SUN_RAY_OUTER;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${SUN}" stroke-width="2" stroke-linecap="round" />`;
  }).join("");

  return [
    // Stacked halo circles approximate the blurred corona/hot-core bloom.
    `<circle cx="${body.x}" cy="${body.y}" r="${SUN_CORONA}" fill="url(#sun-glow-outer)" />`,
    `<circle cx="${body.x}" cy="${body.y}" r="${SUN_CORE}" fill="url(#sun-glow-inner)" />`,
    rays,
    `<circle cx="${body.x}" cy="${body.y}" r="${SUN_DISC}" fill="${SUN}" />`,
  ].join("");
}

function buildMoon(body: { x: number; y: number }): string {
  return [
    `<circle cx="${body.x}" cy="${body.y}" r="${MOON_CORONA}" fill="url(#moon-glow-outer)" />`,
    `<circle cx="${body.x}" cy="${body.y}" r="${MOON_DISC + 4}" fill="url(#moon-glow-inner)" />`,
    `<circle cx="${body.x}" cy="${body.y}" r="${MOON_DISC}" fill="${MOON}" mask="url(#moon-crescent)" />`,
  ].join("");
}
