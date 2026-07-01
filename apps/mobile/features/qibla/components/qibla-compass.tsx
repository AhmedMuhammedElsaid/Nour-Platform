// Qibla compass dial — react-native-svg port of
// apps/web/features/qibla/components/qibla-compass.tsx. The whole rose rotates
// by -heading in live mode so the Kaaba marker shows the real-world turn to make;
// with no magnetometer reading the rose stays north-up (read it like a map). SVG
// fills can't read NativeWind classes, so the palette is resolved from the active
// theme here, exactly like sun-arc.tsx.

import { View } from "react-native";
import Svg, {
  Circle,
  G,
  Line,
  Polygon,
  Text as SvgText,
} from "react-native-svg";

import type { ThemeMode } from "@/lib/theme-context";

const SIZE = 240;
const C = SIZE / 2;
const R = 104;
const ALIGN_TOLERANCE = 6;

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

function angularDiff(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
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
  theme = "dark",
}: {
  bearing: number;
  heading: number | null;
  theme?: ThemeMode;
}) {
  const { gold, sun, muted, surface2, border } = PALETTES[theme];
  const live = heading != null;
  const roseRotation = live ? -heading : 0;
  const aligned = live && angularDiff(heading, bearing) <= ALIGN_TOLERANCE;

  const markerColor = aligned ? sun : gold;
  const marker = polar(bearing, R - 6);
  const markerBase = polar(bearing, R - 34);

  return (
    <View>
      <Svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width="100%"
        style={{ aspectRatio: 1, maxWidth: 320, alignSelf: "center" }}
        accessibilityLabel="Qibla compass"
      >
        {/* Fixed reference triangle at the top — the way you are facing. */}
        <Polygon points={`${C - 8},14 ${C + 8},14 ${C},30`} fill={muted} />

        {/* Dial backdrop */}
        <Circle cx={C} cy={C} r={R + 14} fill={surface2} stroke={border} />

        {/* Rotating rose: ticks + cardinals + Kaaba marker share this rotation. */}
        <G rotation={roseRotation} originX={C} originY={C}>
          {Array.from({ length: 24 }, (_, i) => {
            const angle = i * 15;
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
        </G>

        {/* Centre hub */}
        <Circle cx={C} cy={C} r={5} fill={muted} />
      </Svg>
    </View>
  );
}
