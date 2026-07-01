"use client";

// SVG compass dial. Mirrors the sun-arc conventions: fixed viewBox, theme via
// CSS custom properties (--color-primary / --color-sun / --color-text-2), and
// rotation applied through the SVG `transform` attribute (not CSS) so the rose
// and its markers share one coordinate space. In live mode the whole rose spins
// by -heading, so the Kaaba marker indicates the real-world turn to make; when
// no sensor reading exists the rose stays north-up and the marker sits at the
// raw bearing (read it like a map).

const SIZE = 240;
const C = SIZE / 2; // centre
const R = 104; // rose radius
const ALIGN_TOLERANCE = 6; // degrees within which "facing Qibla" lights up

// Compass angle (0 = north/up, clockwise) → SVG point (north is -y).
function polar(angleDeg: number, radius: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  return { x: C + radius * Math.sin(a), y: C - radius * Math.cos(a) };
}

// Smallest absolute angular distance between two bearings, in [0,180].
function angularDiff(a: number, b: number): number {
  const d = Math.abs(((a - b + 540) % 360) - 180);
  return d;
}

const CARDINALS: Array<{ label: string; angle: number }> = [
  { label: "N", angle: 0 },
  { label: "E", angle: 90 },
  { label: "S", angle: 180 },
  { label: "W", angle: 270 },
];

export function QiblaCompass({
  bearing,
  heading,
  label,
}: {
  bearing: number;
  heading: number | null;
  label: string;
}) {
  const live = heading != null;
  const roseRotation = live ? -heading : 0;
  const aligned = live && angularDiff(heading, bearing) <= ALIGN_TOLERANCE;

  const markerColor = aligned ? "var(--color-sun)" : "var(--color-primary)";
  const marker = polar(bearing, R - 6);
  const markerBase = polar(bearing, R - 34);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      preserveAspectRatio="xMidYMid meet"
      className="mx-auto block h-auto w-full max-w-[320px]"
      role="img"
      aria-label={label}
    >
      {/* Fixed reference triangle at the top — "the way you are facing".
          Only meaningful in live mode, but harmless as a north-marker otherwise. */}
      <polygon
        points={`${C - 8},14 ${C + 8},14 ${C},30`}
        fill="var(--color-text-2)"
      />

      {/* Dial backdrop */}
      <circle
        cx={C}
        cy={C}
        r={R + 14}
        fill="var(--color-surface-2)"
        stroke="var(--color-border)"
      />

      {/* Rotating rose: ticks + cardinals + Kaaba marker share this transform. */}
      <g transform={`rotate(${roseRotation} ${C} ${C})`}>
        {/* Degree ticks every 15°; cardinals are longer. */}
        {Array.from({ length: 24 }, (_, i) => {
          const angle = i * 15;
          const isCardinal = angle % 90 === 0;
          const outer = polar(angle, R);
          const inner = polar(angle, R - (isCardinal ? 14 : 8));
          return (
            <line
              key={angle}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke="var(--color-text-2)"
              strokeOpacity={isCardinal ? 0.9 : 0.4}
              strokeWidth={isCardinal ? 2 : 1}
            />
          );
        })}

        {CARDINALS.map(({ label: c, angle }) => {
          const p = polar(angle, R - 28);
          return (
            <text
              key={c}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="var(--font-display)"
              fontSize="14"
              fill={c === "N" ? "var(--color-primary)" : "var(--color-text-2)"}
            >
              {c}
            </text>
          );
        })}

        {/* Kaaba pointer: a needle from centre to the bearing + a marker head. */}
        <line
          x1={C}
          y1={C}
          x2={markerBase.x}
          y2={markerBase.y}
          stroke={markerColor}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx={marker.x} cy={marker.y} r="12" fill={markerColor} />
        <text
          x={marker.x}
          y={marker.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="13"
        >
          🕋
        </text>
      </g>

      {/* Centre hub */}
      <circle cx={C} cy={C} r="5" fill="var(--color-text-2)" />
    </svg>
  );
}
