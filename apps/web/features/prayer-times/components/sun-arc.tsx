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
}: {
  dots: ArcDot[];
  sunFraction: number; // 0..1 current-time progress
  nextLabel: string;
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
                <circle cx={p.x} cy={p.y} r="16" fill="none" stroke="var(--color-sun)" strokeOpacity="0.32" strokeWidth="2" />
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

      {/* current sun — gold disc + rays; glides toward the next prayer as time passes */}
      <g
        style={{
          transform: `translate(${sun.x}px, ${sun.y}px)`,
          transition: "transform 900ms linear",
        }}
        stroke="var(--color-sun)"
      >
        <g strokeWidth="2" strokeLinecap="round">
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
    </svg>
  );
}
