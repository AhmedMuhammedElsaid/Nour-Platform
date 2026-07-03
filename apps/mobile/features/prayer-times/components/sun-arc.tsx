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

import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
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
  Text as SvgText,
} from "react-native-svg";

import { ARC, arcPath, arcPoint, tForFraction } from "@repo/shared-core/prayer-times/sun-arc";
import type { ArcDot } from "@/features/prayer-times/lib/arc-dots";
import type { ThemeMode } from "@/lib/theme-context";

// Animated corona so the sun/moon glow gently throbs like a real light source,
// mirroring the web component's `animate-pulse` on the corona circle.
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Design tokens, mirrored from packages/ui/src/styles/tokens.css. SVG fills can't
// read NativeWind classes, so the palette is resolved here from the active theme —
// the same hexes the web reads via CSS vars (`var(--color-*)`) that flip per theme.
// GOLD = --color-primary, SUN = --color-sun, MOON = --color-moon, MUTED =
// --color-text-2 (the web's non-next dot fill). Light values keep the moon legible
// on the pale background, where the dark silver-blue would wash out (point 9).
type ArcPalette = { gold: string; sun: string; moon: string; muted: string };
const PALETTES: Record<ThemeMode, ArcPalette> = {
  dark: { gold: "#c8a050", sun: "#e4c57e", moon: "#d6e3ff", muted: "#8a7a62" },
  light: { gold: "#9a7830", sun: "#c8a050", moon: "#4a6fb8", muted: "#3f4a44" },
};

// Body sizes, enlarged from the web's phone-cramped defaults so the sun/moon read
// clearly on a handset (point 2). Sun disc 5.5→9, moon disc 9→12, coronas scaled
// to match; rays extend proportionally from the larger disc.
const SUN_DISC = 9;
const SUN_CORE = 11;
const SUN_CORONA = 28;
const SUN_RAY_INNER = 14;
const SUN_RAY_OUTER = 20;
const MOON_DISC = 12;
const MOON_CORONA = 30;

// The night track is the day arc scaled toward the horizon. Mirrors the web
// component's inline NIGHT_BAND/lowerToBand (shared-core owns only the base arc
// geometry; the band derivation lives with each renderer).
const NIGHT_BAND = 0.34;
const lowerToBand = (y: number) => ARC.p0.y - (ARC.p0.y - y) * NIGHT_BAND;

// 8 sun rays, each a short line between SUN_RAY_INNER and SUN_RAY_OUTER.
const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

type SunArcProps = {
  dots: ArcDot[];
  // 0..1 progress of the active body: the sun's Fajr→Isha day, or the moon's
  // Isha→Fajr night (the caller decides via getArcPosition).
  fraction: number;
  // True before Fajr / at-or-after Isha — render a glowing crescent moon on the
  // night band instead of the sun on the day arc.
  isNight?: boolean;
  // True only on the night band (Isha→dawn). Between Maghrib and Isha the moon
  // is up (`isNight`) but still rides the day arc, so the body sits on the same
  // axis the sun just left — no vertical jump at sunset. Defaults to `isNight`.
  onNightBand?: boolean;
  // Active theme — selects the light/dark hex palette (SVG can't read NativeWind).
  theme?: ThemeMode;
  // Draw the localized prayer name above each dot (dots must carry `label`). Only
  // the full prayer-times screen enables this — the small Home widget's arc is too
  // cramped and already has a labeled row below it.
  showLabels?: boolean;
};

export function SunArc({
  dots,
  fraction,
  isNight = false,
  onNightBand = isNight,
  theme = "dark",
  showLabels = false,
}: SunArcProps) {
  const { gold: GOLD, sun: SUN, moon: MOON, muted: MUTED } = PALETTES[theme];
  const point = arcPoint(tForFraction(fraction));
  // On the night band the body drops to the lowered track; otherwise (sun, or
  // the moon's dusk leg) it rides the day arc as-is.
  const body = onNightBand ? { x: point.x, y: lowerToBand(point.y) } : point;
  // Same quadratic as arcPath() with its control point lowered — yields the band.
  const nightBandPath = `M${ARC.p0.x} ${ARC.p0.y} Q${ARC.p1.x} ${lowerToBand(
    ARC.p1.y,
  )} ${ARC.p2.x} ${ARC.p2.y}`;

  // Mirror the web corona's `animate-pulse`: a 2s ease-in-out breathe between
  // full and half opacity (1s each way via the reversing repeat). Runs on the
  // UI thread, so there are no JS timers to leak under jest.
  const coronaOpacity = useSharedValue(1);
  useEffect(() => {
    coronaOpacity.value = withRepeat(
      withTiming(0.5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(coronaOpacity);
    // coronaOpacity is a stable shared-value ref; run the pulse once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const coronaProps = useAnimatedProps(() => ({ opacity: coronaOpacity.value }));

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
              <Circle cx={body.x} cy={body.y} r={MOON_DISC} fill="white" />
              <Circle cx={body.x + 4.5} cy={body.y - 2.5} r={MOON_DISC - 1} fill="black" />
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

        {/* prayer name labels above each dot (full-screen arc only). Neighbouring
            dots (Fajr/Sunrise on the left, Maghrib/Isha on the right) sit close, so
            labels alternate between two heights to avoid overlap; the end labels are
            edge-anchored so they never spill past the viewBox. */}
        {showLabels &&
          dots.map((dot, i) => {
            if (!dot.label) return null;
            const pt = arcPoint(tForFraction(dot.fraction));
            const stagger = i % 2 === 0 ? 12 : 26;
            // Lift the "next" label clear of its larger glow ring.
            const labelY = pt.y - (dot.isNext ? Math.max(stagger, 30) : stagger);
            const anchor =
              dot.fraction <= 0.1 ? "start" : dot.fraction >= 0.9 ? "end" : "middle";
            return (
              <SvgText
                key={`label-${dot.key}`}
                testID={`arc-label-${dot.key}`}
                x={pt.x}
                y={labelY}
                textAnchor={anchor}
                fontSize={15}
                fontWeight={dot.isNext ? "700" : "400"}
                fill={dot.isNext ? SUN : MUTED}
              >
                {dot.label}
              </SvgText>
            );
          })}

        {/* current body: glowing crescent moon at night, rayed sun by day */}
        {isNight ? (
          <>
            {/* moonlight corona — gently pulses, mirroring the web's animate-pulse */}
            <AnimatedCircle cx={body.x} cy={body.y} r={MOON_CORONA} fill="url(#moon-glow)" animatedProps={coronaProps} />
            {/* blurred crescent under the crisp one → soft glowing edge */}
            <Circle
              cx={body.x}
              cy={body.y}
              r={MOON_DISC}
              fill={MOON}
              mask="url(#moon-crescent)"
              filter="url(#moon-bloom)"
            />
            <Circle
              testID="prayer-moon"
              cx={body.x}
              cy={body.y}
              r={MOON_DISC}
              fill={MOON}
              mask="url(#moon-crescent)"
            />
          </>
        ) : (
          <>
            {/* breathing corona — large soft halo that gently pulses like real glow */}
            <AnimatedCircle cx={body.x} cy={body.y} r={SUN_CORONA} fill="url(#sun-glow)" animatedProps={coronaProps} />
            {/* blurred hot core under the crisp disc for a bloomed light source */}
            <Circle cx={body.x} cy={body.y} r={SUN_CORE} fill={SUN} filter="url(#sun-bloom)" />
            {/* bloomed rays */}
            <G stroke={SUN} strokeWidth={2} strokeLinecap="round" filter="url(#sun-bloom)">
              {RAY_ANGLES.map((angle) => {
                const rad = (angle * Math.PI) / 180;
                return (
                  <Line
                    key={angle}
                    x1={body.x + Math.cos(rad) * SUN_RAY_INNER}
                    y1={body.y + Math.sin(rad) * SUN_RAY_INNER}
                    x2={body.x + Math.cos(rad) * SUN_RAY_OUTER}
                    y2={body.y + Math.sin(rad) * SUN_RAY_OUTER}
                  />
                );
              })}
            </G>
            {/* crisp disc on top */}
            <Circle testID="prayer-sun" cx={body.x} cy={body.y} r={SUN_DISC} fill={SUN} />
          </>
        )}
      </Svg>
    </View>
  );
}
