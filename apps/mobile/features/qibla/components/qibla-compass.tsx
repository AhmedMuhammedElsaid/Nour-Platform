// Qibla compass dial — react-native-svg. The rose (ticks, cardinals, Kaaba marker)
// rotates by -heading; with no reading it stays north-up (read it like a map).
//
// Rotation runs on the UI thread: the rose SVG is drawn once and rotated via a
// reanimated View transform (GPU-composited, like the web's CSS transform), fed by a
// SharedValue from useCompassHeading. The fixed reference pointer + hub are a static
// overlay. Heading now comes from the native fused rotation-vector sensor, so it is
// smooth AND accurate (no "accuracy 0"). SVG fills can't read NativeWind classes, so
// the palette is resolved from the theme here.

import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";

import type { ThemeMode } from "@/lib/theme-context";

const SIZE = 240;
const C = SIZE / 2;
const R = 104;

type Palette = {
  gold: string;
  sun: string;
  muted: string;
  surface2: string;
  border: string;
};
const PALETTES: Record<ThemeMode, Palette> = {
  dark: { gold: "#c8a050", sun: "#e4c57e", muted: "#8a7a62", surface2: "#252018", border: "rgba(200,160,80,0.15)" },
  light: { gold: "#9a7830", sun: "#c8a050", muted: "#3f4a44", surface2: "#f4f1e8", border: "#e6e2d7" },
};

// Compass angle (0 = north/up, clockwise) → SVG point (north is -y).
function polar(angleDeg: number, radius: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  return { x: C + radius * Math.sin(a), y: C - radius * Math.cos(a) };
}

const CARDINALS: Array<{ label: string; angle: number }> = [
  { label: "N", angle: 0 },
  { label: "E", angle: 90 },
  { label: "S", angle: 180 },
  { label: "W", angle: 270 },
];
const TICKS = Array.from({ length: 24 }, (_, i) => i * 15);

export type QiblaCompassProps = {
  bearing: number;
  // Continuous (unwrapped) heading in degrees, or null before the first reading.
  // Drives the UI-thread rotation; never triggers a React re-render.
  headingSV: SharedValue<number | null>;
  // Within the alignment tolerance — highlights the marker (changes rarely).
  aligned: boolean;
  theme?: ThemeMode;
};

export const QiblaCompass = memo(function QiblaCompass({
  bearing,
  headingSV,
  aligned,
  theme = "dark",
}: QiblaCompassProps) {
  const { gold, sun, muted, surface2, border } = PALETTES[theme];
  const markerColor = aligned ? sun : gold;
  const marker = polar(bearing, R - 6);
  const markerBase = polar(bearing, R - 34);

  // Rotate the dial on the UI thread. `-heading` because turning the phone right
  // swings the rose left. Null → north-up.
  const dialStyle = useAnimatedStyle(() => {
    const h = headingSV.value;
    return { transform: [{ rotate: `${h == null ? 0 : -h}deg` }] };
  });

  return (
    <View style={{ width: "100%", maxWidth: 320, aspectRatio: 1, alignSelf: "center" }}>
      {/* Rotating dial (drawn once; the View transform is UI-thread/GPU). */}
      <Animated.View style={[StyleSheet.absoluteFill, dialStyle]}>
        <Svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" height="100%" accessibilityLabel="Qibla compass">
          <Circle cx={C} cy={C} r={R + 14} fill={surface2} stroke={border} />

          {TICKS.map((angle) => {
            const isCardinal = angle % 90 === 0;
            const outer = polar(angle, R);
            const inner = polar(angle, R - (isCardinal ? 14 : 8));
            return (
              <Line
                key={angle}
                x1={outer.x}
                y1={outer.y}
                x2={inner.x}
                y2={inner.y}
                stroke={muted}
                strokeOpacity={isCardinal ? 0.9 : 0.4}
                strokeWidth={isCardinal ? 2 : 1}
              />
            );
          })}

          {CARDINALS.map(({ label, angle }) => {
            const p = polar(angle, R - 28);
            return (
              <SvgText
                key={label}
                x={p.x}
                y={p.y}
                textAnchor="middle"
                alignmentBaseline="central"
                fontSize={14}
                fill={label === "N" ? gold : muted}
              >
                {label}
              </SvgText>
            );
          })}

          <Line
            x1={C}
            y1={C}
            x2={markerBase.x}
            y2={markerBase.y}
            stroke={markerColor}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <Circle testID="qibla-marker" cx={marker.x} cy={marker.y} r={12} fill={markerColor} />
          <SvgText
            x={marker.x}
            y={marker.y}
            textAnchor="middle"
            alignmentBaseline="central"
            fontSize={13}
          >
            🕋
          </SvgText>
        </Svg>
      </Animated.View>

      {/* Static overlay: fixed reference pointer (the way you face) + centre hub. */}
      <Svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width="100%"
        height="100%"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Polygon points={`${C - 8},14 ${C + 8},14 ${C},30`} fill={muted} />
        <Circle cx={C} cy={C} r={5} fill={muted} />
      </Svg>
    </View>
  );
});
