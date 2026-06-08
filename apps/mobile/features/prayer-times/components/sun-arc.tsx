// Sun arc SVG — mirrors apps/web/features/prayer-times/components/sun-arc.tsx.
// Uses react-native-svg (already in deps from Phase 4).
// Gold rayed sun = current time; glowing dot = next prayer.

import { View } from "react-native";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";

import {
  ARC,
  arcPath,
  arcPoint,
  tForFraction,
} from "@repo/shared-core/prayer-times/sun-arc";
import type { PrayerInstant, PrayerKey } from "@repo/shared-core/prayer-times/compute";
import { getDayProgress } from "@repo/shared-core/prayer-times/compute";
import type { PrayerDay } from "@repo/shared-core/prayer-times/compute";

// Gold / near-black from design tokens.
const GOLD = "#c8a050";
const MUTED = "#7a6a52";

type ArcDot = {
  key: PrayerKey;
  label: string;
  fraction: number;
  isNext: boolean;
};

type SunArcProps = {
  day: PrayerDay;
  now: Date;
  nextPrayerKey: PrayerKey | null;
  prayerLabels: Partial<Record<PrayerKey, string>>;
};

export function SunArc({ day, now, nextPrayerKey, prayerLabels }: SunArcProps) {
  const progress = getDayProgress(day, now);
  const sunT = tForFraction(progress);
  const sunPt = arcPoint(sunT);

  const dots: ArcDot[] = day.instants
    .filter((inst): inst is PrayerInstant & { time: Date } => inst.time != null)
    .map((inst, _, arr) => {
      const fajr = arr.find((i) => i.key === "fajr")?.time ?? null;
      const isha = arr.find((i) => i.key === "isha")?.time ?? null;
      let fraction = 0;
      if (fajr != null && isha != null && isha.getTime() > fajr.getTime()) {
        fraction = Math.min(
          1,
          Math.max(
            0,
            (inst.time.getTime() - fajr.getTime()) /
              (isha.getTime() - fajr.getTime()),
          ),
        );
      }
      return {
        key: inst.key,
        label: prayerLabels[inst.key] ?? inst.key,
        fraction,
        isNext: inst.key === nextPrayerKey,
      };
    });

  return (
    <View>
      <Svg
        viewBox={`0 0 ${ARC.w} ${ARC.h}`}
        width="100%"
        style={{ aspectRatio: ARC.w / ARC.h }}
        accessibilityLabel="Sun arc prayer times visualization"
      >
        {/* Background arc path */}
        <Path
          d={arcPath()}
          fill="none"
          stroke={MUTED}
          strokeWidth={2}
          strokeOpacity={0.4}
        />

        {/* Prayer dots */}
        {dots.map((dot) => {
          const t = tForFraction(dot.fraction);
          const pt = arcPoint(t);
          return (
            <Circle
              key={dot.key}
              cx={pt.x}
              cy={pt.y}
              r={dot.isNext ? 7 : 4}
              fill={dot.isNext ? GOLD : MUTED}
              opacity={dot.isNext ? 1 : 0.7}
            />
          );
        })}

        {/* Labels below dots */}
        {dots.map((dot) => {
          const t = tForFraction(dot.fraction);
          const pt = arcPoint(t);
          return (
            <SvgText
              key={`${dot.key}-label`}
              x={pt.x}
              y={pt.y + 20}
              fontSize={10}
              textAnchor="middle"
              fill={dot.isNext ? GOLD : MUTED}
              fontWeight={dot.isNext ? "bold" : "normal"}
            >
              {dot.label}
            </SvgText>
          );
        })}

        {/* Sun (current time) */}
        <Circle cx={sunPt.x} cy={sunPt.y} r={10} fill={GOLD} />
        {/* Simple rays */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const x1 = sunPt.x + Math.cos(rad) * 13;
          const y1 = sunPt.y + Math.sin(rad) * 13;
          const x2 = sunPt.x + Math.cos(rad) * 17;
          const y2 = sunPt.y + Math.sin(rad) * 17;
          return (
            <Path
              key={angle}
              d={`M${x1} ${y1} L${x2} ${y2}`}
              stroke={GOLD}
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}
      </Svg>
    </View>
  );
}
