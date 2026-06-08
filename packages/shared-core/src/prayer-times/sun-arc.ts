// Fixed SVG coordinate space for the arc. The component renders one <svg> with
// this viewBox and preserveAspectRatio="xMidYMid meet" + width:100% height:auto,
// so it scales uniformly to the container width (circles stay round, dots align
// with the path). All geometry below is in this space.
export const ARC = {
  w: 600,
  h: 150,
  p0: { x: 0, y: 126 }, // left horizon
  p1: { x: 300, y: -4 }, // control point (apex pull)
  p2: { x: 600, y: 126 }, // right horizon
} as const;

// Inset so endpoints (Fajr/Isha) don't sit exactly in the corners.
const INSET = 0.06;

export function tForFraction(fraction: number): number {
  const f = Math.min(1, Math.max(0, fraction));
  return INSET + f * (1 - 2 * INSET);
}

export function arcPoint(t: number): { x: number; y: number } {
  const mt = 1 - t;
  const x = mt * mt * ARC.p0.x + 2 * mt * t * ARC.p1.x + t * t * ARC.p2.x;
  const y = mt * mt * ARC.p0.y + 2 * mt * t * ARC.p1.y + t * t * ARC.p2.y;
  return { x, y };
}

export function arcPath(): string {
  return `M${ARC.p0.x} ${ARC.p0.y} Q${ARC.p1.x} ${ARC.p1.y} ${ARC.p2.x} ${ARC.p2.y}`;
}
