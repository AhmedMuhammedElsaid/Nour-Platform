// Sun/moon arc SVG — faithful port of apps/web/features/prayer-times/components/
// sun-arc.tsx. Two axes share the same left→right curve: a DAY arc (the sun's
// Fajr→Isha track) and a lower NIGHT band (the moon's Isha→Fajr track), the band
// scaled toward the horizon by NIGHT_BAND so the moon clears the daytime dots.
// The caller decides which body is active (`isNight`) and its progress
// (`fraction`) via getArcPosition; this component is presentational.
//
// The glow is the real web recipe, not an approximation: a radial-gradient corona
// + an feGaussianBlur bloom on the hot core and rays (react-native-svg ≥15 ships
// SVG filters, so the same <Filter><FeGaussianBlur/> the web uses works here).

import { View } from "react-native";
import Svg, {
  Circle,
  Defs,
  FeGaussianBlur,
  Filter,
  G,
  Line,
  LinearGradient,
  Mask,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";

import { ARC, arcPath, arcPoint, tForFraction } from "@repo/shared-core/prayer-times/sun-arc";
import type { ArcDot } from "@/features/prayer-times/lib/arc-dots";

// Design tokens (dark palette, mirrored from packages/ui/src/styles/tokens.css).
// SVG fills can't read NativeWind classes, so they're local consts — same pattern
// the web component uses with CSS vars. GOLD = --color-primary, SUN = --color-sun
// (brighter gold), MOON = --color-moon (silver-blue).
const GOLD = "#c8a050";
const SUN = "#e4c57e";
const MUTED = "#7a6a52";
const MOON = "#d6e3ff";

// The night track is the day arc scaled toward the horizon. Mirrors the web
// component's inline NIGHT_BAND/lowerToBand (shared-core owns only the base arc
// geometry; the band derivation lives with each renderer).
const NIGHT_BAND = 0.34;
const lowerToBand = (y: number) => ARC.p0.y - (ARC.p0.y - y) * NIGHT_BAND;

// 8 sun rays, each a short line between radius 9 and 13 around the disc.
const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

type SunArcProps = {
  dots: ArcDot[];
  // 0..1 progress of the active body: the sun's Fajr→Isha day, or the moon's
  // Isha→Fajr night (the caller decides via getArcPosition).
  fraction: number;
  // True before Fajr / at-or-after Isha — render a glowing crescent moon on the
  // night band instead of the sun on the day arc.
  isNight?: boolean;
};

export function SunArc({ dots, fraction, isNight = false }: SunArcProps) {
  const point = arcPoint(tForFraction(fraction));
  // The moon rides the lowered night band; the sun rides the day arc as-is.
  const body = isNight ? { x: point.x, y: lowerToBand(point.y) } : point;
  // Same quadratic as arcPath() with its control point lowered — yields the band.
  const nightBandPath = `M${ARC.p0.x} ${ARC.p0.y} Q${ARC.p1.x} ${lowerToBand(
    ARC.p1.y,
  )} ${ARC.p2.x} ${ARC.p2.y}`;

  return (
    <View>
      <Svg
        viewBox={`0 0 ${ARC.w} ${ARC.h}`}
        width="100%"
        style={{ aspectRatio: ARC.w / ARC.h }}
        accessibilityLabel="Sun and moon arc prayer times visualization"
      >
        <Defs>
          {/* day-arc gradient: faint at the horizons, bright at the apex */}
          <LinearGradient id="arc-grad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={GOLD} stopOpacity={0.15} />
            <Stop offset="0.5" stopColor={SUN} stopOpacity={1} />
            <Stop offset="1" stopColor={GOLD} stopOpacity={0.15} />
          </LinearGradient>
          {/* soft radiant corona so the sun reads as a real light source */}
          <RadialGradient id="sun-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={SUN} stopOpacity={0.6} />
            <Stop offset="0.45" stopColor={SUN} stopOpacity={0.22} />
            <Stop offset="1" stopColor={SUN} stopOpacity={0} />
          </RadialGradient>
          {/* silver-blue moonlight halo — same radial structure as the sun */}
          <RadialGradient id="moon-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={MOON} stopOpacity={0.55} />
            <Stop offset="0.45" stopColor={MOON} stopOpacity={0.2} />
            <Stop offset="1" stopColor={MOON} stopOpacity={0} />
          </RadialGradient>
          {/* bloom the hot core + rays for that over-bright, glowing look */}
          <Filter id="sun-bloom" x="-75%" y="-75%" width="250%" height="250%">
            <FeGaussianBlur stdDeviation="2.2" />
          </Filter>
          <Filter id="moon-bloom" x="-75%" y="-75%" width="250%" height="250%">
            <FeGaussianBlur stdDeviation="2.2" />
          </Filter>
          {isNight && (
            // Crescent: subtract an offset disc from the moon disc. White =
            // visible, black = hidden. Absolute coords match the moon's cx/cy
            // (no transforms in this SVG), so the mask always aligns.
            <Mask id="moon-crescent">
              <Circle cx={body.x} cy={body.y} r={9} fill="white" />
              <Circle cx={body.x + 3.5} cy={body.y - 2} r={8.5} fill="black" />
            </Mask>
          )}
        </Defs>

        {/* horizon */}
        <Line x1={0} y1={ARC.p0.y} x2={ARC.w} y2={ARC.p0.y} stroke={GOLD} strokeOpacity={0.14} />

        {/* day arc — the sun's Fajr→Isha track */}
        <Path
          d={arcPath()}
          fill="none"
          stroke="url(#arc-grad)"
          strokeWidth={2}
          strokeDasharray="2 7"
        />

        {/* night band — the moon's lower Isha→Fajr track (the second axis) */}
        <Path
          d={nightBandPath}
          fill="none"
          stroke={MOON}
          strokeWidth={2}
          strokeOpacity={0.22}
          strokeDasharray="2 7"
        />

        {/* prayer dots — always on the day arc; the next prayer glows gold */}
        {dots.map((dot) => {
          const pt = arcPoint(tForFraction(dot.fraction));
          if (dot.isNext) {
            return (
              <Circle
                key={dot.key}
                cx={pt.x}
                cy={pt.y}
                r={7}
                fill={SUN}
                stroke={SUN}
                strokeOpacity={0.32}
                strokeWidth={3}
              />
            );
          }
          return <Circle key={dot.key} cx={pt.x} cy={pt.y} r={3.5} fill={MUTED} opacity={0.7} />;
        })}

        {/* current body: glowing crescent moon at night, rayed sun by day */}
        {isNight ? (
          <>
            {/* moonlight corona */}
            <Circle cx={body.x} cy={body.y} r={26} fill="url(#moon-glow)" />
            {/* blurred crescent under the crisp one → soft glowing edge */}
            <Circle
              cx={body.x}
              cy={body.y}
              r={9}
              fill={MOON}
              mask="url(#moon-crescent)"
              filter="url(#moon-bloom)"
            />
            <Circle
              testID="prayer-moon"
              cx={body.x}
              cy={body.y}
              r={9}
              fill={MOON}
              mask="url(#moon-crescent)"
            />
          </>
        ) : (
          <>
            {/* breathing corona — large soft halo like real glow */}
            <Circle cx={body.x} cy={body.y} r={24} fill="url(#sun-glow)" />
            {/* blurred hot core under the crisp disc for a bloomed light source */}
            <Circle cx={body.x} cy={body.y} r={7} fill={SUN} filter="url(#sun-bloom)" />
            {/* bloomed rays */}
            <G stroke={SUN} strokeWidth={2} strokeLinecap="round" filter="url(#sun-bloom)">
              {RAY_ANGLES.map((angle) => {
                const rad = (angle * Math.PI) / 180;
                return (
                  <Line
                    key={angle}
                    x1={body.x + Math.cos(rad) * 9}
                    y1={body.y + Math.sin(rad) * 9}
                    x2={body.x + Math.cos(rad) * 13}
                    y2={body.y + Math.sin(rad) * 13}
                  />
                );
              })}
            </G>
            {/* crisp disc on top */}
            <Circle testID="prayer-sun" cx={body.x} cy={body.y} r={5.5} fill={SUN} />
          </>
        )}
      </Svg>
    </View>
  );
}
