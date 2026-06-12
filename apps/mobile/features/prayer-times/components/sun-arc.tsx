// Sun arc SVG — mirrors apps/web/features/prayer-times/components/sun-arc.tsx.
// Uses react-native-svg (already in deps from Phase 4).
// Gold rayed sun = current time; glowing dot = next prayer.

import { View } from "react-native";
import Svg, { Circle, Defs, Mask, Path } from "react-native-svg";

import {
  ARC,
  arcPath,
  arcPoint,
  tForFraction,
} from "@repo/shared-core/prayer-times/sun-arc";
import type { PrayerInstant, PrayerKey } from "@repo/shared-core/prayer-times/compute";
import { getDayProgress } from "@repo/shared-core/prayer-times/compute";
import type { PrayerDay } from "@repo/shared-core/prayer-times/compute";

// Design tokens (dark palette). MOON is the silver-blue from tokens.css.
const GOLD = "#c8a050";
const MUTED = "#7a6a52";
const MOON = "#d6e3ff";

type ArcDot = {
  key: PrayerKey;
  fraction: number;
  isNext: boolean;
};

type SunArcProps = {
  day: PrayerDay;
  now: Date;
  nextPrayerKey: PrayerKey | null;
};

// The arc shows the sun/moon position and highlights the next prayer's dot; the
// prayer names + times live in the countdown and timetable directly below it.
// In-arc labels are deliberately omitted — at phone width the 600-unit viewBox
// scales them to ~6px and they collide (the same readability bug the web arc
// hides below `sm`). Mobile is always phone-width, so they're dropped outright.
export function SunArc({ day, now, nextPrayerKey }: SunArcProps) {
  const progress = getDayProgress(day, now);
  const sunT = tForFraction(progress);
  const sunPt = arcPoint(sunT);

  // Night = before today's Fajr or at/after today's Isha — swap the sun for a
  // glowing crescent moon (parity with the web sun-arc).
  const fajr = day.instants.find((i) => i.key === "fajr")?.time ?? null;
  const isha = day.instants.find((i) => i.key === "isha")?.time ?? null;
  const isNight =
    (fajr != null && now.getTime() < fajr.getTime()) ||
    (isha != null && now.getTime() >= isha.getTime());

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
        {isNight && (
          <Defs>
            {/* Crescent: subtract an offset disc from the moon disc. White =
                visible, black = hidden. Absolute coords match the moon's
                cx/cy (no transforms in this SVG), so it always aligns. */}
            <Mask id="moon-crescent">
              <Circle cx={sunPt.x} cy={sunPt.y} r={11} fill="white" />
              <Circle cx={sunPt.x + 4} cy={sunPt.y - 2.5} r={10} fill="black" />
            </Mask>
          </Defs>
        )}

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

        {/* Current time marker — glowing crescent moon at night, rayed sun by day. */}
        {isNight ? (
          <>
            {/* soft moonlight halo */}
            <Circle cx={sunPt.x} cy={sunPt.y} r={17} fill={MOON} opacity={0.16} />
            {/* crescent (mask-carved; degrades to a full disc if Mask is
                unsupported — either way the moon stays visible) */}
            <Circle
              testID="prayer-moon"
              cx={sunPt.x}
              cy={sunPt.y}
              r={11}
              fill={MOON}
              mask="url(#moon-crescent)"
            />
          </>
        ) : (
          <>
            {/* Sun (current time) */}
            <Circle testID="prayer-sun" cx={sunPt.x} cy={sunPt.y} r={10} fill={GOLD} />
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
          </>
        )}
      </Svg>
    </View>
  );
}
