import { ARC, arcPath, arcPoint, tForFraction } from "@/features/prayer-times/lib/sun-arc";
import type { PrayerKey } from "@repo/api/services/prayer-times";

export type ArcDot = {
  key: PrayerKey;
  fraction: number; // 0..1 position along the Fajr→Isha day
  isNext: boolean;
  label: string; // localized prayer name shown above the point
};

export function SunArc({
  dots,
  sunFraction,
  nextLabel,
  isNight = false,
}: {
  dots: ArcDot[];
  sunFraction: number; // 0..1 current-time progress
  nextLabel: string;
  // True before Fajr / after Isha — swap the sun for a glowing moon.
  isNight?: boolean;
}) {
  const sun = arcPoint(tForFraction(sunFraction));

  return (
    <svg
      viewBox={`0 0 ${ARC.w} ${ARC.h}`}
      preserveAspectRatio="xMidYMid meet"
      className="block w-full h-auto"
      role="img"
      aria-label={nextLabel}
    >
      <defs>
        <linearGradient id="nour-arc-grad" x1="0" x2="1">
          <stop offset="0" stopColor="var(--color-primary)" stopOpacity="0.15" />
          <stop offset="0.5" stopColor="var(--color-sun)" />
          <stop offset="1" stopColor="var(--color-primary)" stopOpacity="0.15" />
        </linearGradient>
        {/* soft radiant corona so the sun reads as a real light source */}
        <radialGradient id="nour-sun-glow">
          <stop offset="0" stopColor="var(--color-sun)" stopOpacity="0.6" />
          <stop offset="45%" stopColor="var(--color-sun)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--color-sun)" stopOpacity="0" />
        </radialGradient>
        {/* bloom the hot core + rays for that over-bright, glowing look */}
        <filter id="nour-sun-bloom" x="-75%" y="-75%" width="250%" height="250%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        {/* silver-blue moonlight halo — same radial structure as the sun glow */}
        <radialGradient id="nour-moon-glow">
          <stop offset="0" stopColor="var(--color-moon)" stopOpacity="0.55" />
          <stop offset="45%" stopColor="var(--color-moon)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--color-moon)" stopOpacity="0" />
        </radialGradient>
        <filter id="nour-moon-bloom" x="-75%" y="-75%" width="250%" height="250%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        {/* Crescent mask: subtract an offset disc from the moon disc to carve
            the crescent shape (white = visible, black = hidden). */}
        <mask id="nour-moon-crescent" maskUnits="userSpaceOnUse" x="-12" y="-12" width="24" height="24">
          <circle cx="0" cy="0" r="9" fill="white" />
          <circle cx="3.5" cy="-2" r="8.5" fill="black" />
        </mask>
      </defs>

      {/* horizon */}
      <line
        x1="0"
        y1={ARC.p0.y}
        x2={ARC.w}
        y2={ARC.p0.y}
        stroke="var(--color-primary)"
        strokeOpacity="0.14"
      />
      {/* arc */}
      <path
        d={arcPath()}
        fill="none"
        stroke="url(#nour-arc-grad)"
        strokeWidth="2"
        strokeDasharray="2 7"
      />

      {/* prayer dots + name labels */}
      {dots.map((d) => {
        const p = arcPoint(tForFraction(d.fraction));
        // Lift the label clear of the dot (and clear of the glow ring for next).
        const labelY = p.y - (d.isNext ? 24 : 14);
        return (
          <g key={d.key}>
            {d.isNext ? (
              <>
                <circle cx={p.x} cy={p.y} r="8" fill="none" stroke="var(--color-sun)" strokeOpacity="0.32" strokeWidth="2" />
                <circle cx={p.x} cy={p.y} r="7" fill="var(--color-sun)" />
              </>
            ) : (
              <circle cx={p.x} cy={p.y} r="3.5" fill="var(--color-text-2)" />
            )}
            <text
              x={p.x}
              y={labelY}
              textAnchor="middle"
              fontFamily="var(--font-display)"
              fontSize="13"
              fontWeight={d.isNext ? 600 : 400}
              fill={d.isNext ? "var(--color-sun)" : "var(--color-text-2)"}
            >
              {d.label}
            </text>
          </g>
        );
      })}

      {/* current sun or moon — glides toward the next prayer as time passes */}
      <g
        style={{
          transform: `translate(${sun.x}px, ${sun.y}px)`,
          transition: "transform 900ms linear",
        }}
      >
        {isNight ? (
          // Night: glowing silver-blue crescent. Same radial halo + bloom
          // recipe as the sun so the two read as siblings, not different
          // styles. The crescent shape is carved by `nour-moon-crescent`.
          <g stroke="var(--color-moon)">
            <circle cx="0" cy="0" r="26" fill="url(#nour-moon-glow)" stroke="none" className="animate-pulse" />
            <circle
              cx="0"
              cy="0"
              r="9"
              fill="var(--color-moon)"
              stroke="none"
              mask="url(#nour-moon-crescent)"
              filter="url(#nour-moon-bloom)"
            />
            <circle
              cx="0"
              cy="0"
              r="9"
              fill="var(--color-moon)"
              stroke="none"
              mask="url(#nour-moon-crescent)"
            />
          </g>
        ) : (
          <g stroke="var(--color-sun)">
            {/* breathing corona — large soft halo that gently pulses like real glow */}
            <circle cx="0" cy="0" r="24" fill="url(#nour-sun-glow)" stroke="none" className="animate-pulse" />
            {/* blurred hot core sitting under the crisp disc for a bloomed light source */}
            <circle cx="0" cy="0" r="7" fill="var(--color-sun)" stroke="none" filter="url(#nour-sun-bloom)" />
            <g strokeWidth="2" strokeLinecap="round" filter="url(#nour-sun-bloom)">
              <line x1="0" y1="-13" x2="0" y2="-9" />
              <line x1="0" y1="9" x2="0" y2="13" />
              <line x1="-13" y1="0" x2="-9" y2="0" />
              <line x1="9" y1="0" x2="13" y2="0" />
              <line x1="-9.2" y1="-9.2" x2="-6.4" y2="-6.4" />
              <line x1="6.4" y1="6.4" x2="9.2" y2="9.2" />
              <line x1="9.2" y1="-9.2" x2="6.4" y2="-6.4" />
              <line x1="-6.4" y1="6.4" x2="-9.2" y2="9.2" />
            </g>
            <circle cx="0" cy="0" r="5.5" fill="var(--color-sun)" stroke="none" />
          </g>
        )}
      </g>
    </svg>
  );
}
