// Bottom-tab stroke icons drawn with react-native-svg. SVG can't read NativeWind/
// Tailwind classes, so each icon takes its color as an explicit `color` prop —
// same reasoning as features/prayer-times/components/sun-arc.tsx, which keeps
// local color consts because SVG fills/strokes can't resolve NativeWind classes.
// All icons share a 24x24 viewBox, 2px round strokes, no fill (save the small
// filled beads on the tasbih), and ~2px padding from the edges for balance.

import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

type TabIconProps = { color: string; size?: number };

export function HomeIcon({ color, size = 24 }: TabIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Roof triangle + body */}
      <Path d="M3 11 12 3l9 8" />
      <Path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      {/* Door */}
      <Path d="M10 21v-5h4v5" />
    </Svg>
  );
}

export function QuranIcon({ color, size = 24 }: TabIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Center spine */}
      <Line x1={12} y1={6} x2={12} y2={20} />
      {/* Left page */}
      <Path d="M12 6C10 4.5 7 4.5 4 5.5V18c3-1 6-1 8 .5" />
      {/* Right page */}
      <Path d="M12 6c2-1.5 5-1.5 8-.5V18c-3-1-6-1-8 .5" />
    </Svg>
  );
}

export function AdhkarIcon({ color, size = 24 }: TabIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* String/loop of the misbaha */}
      <Path d="M5 7a7 5.5 0 0 0 14 0" strokeWidth={1.5} />
      {/* Beads strung along the loop */}
      <Circle cx={5} cy={7} r={1.8} fill={color} stroke="none" />
      <Circle cx={9} cy={11.2} r={1.8} fill={color} stroke="none" />
      <Circle cx={15} cy={11.2} r={1.8} fill={color} stroke="none" />
      <Circle cx={19} cy={7} r={1.8} fill={color} stroke="none" />
      {/* Pendant bead hanging from the loop's low point */}
      <Path d="M12 13v3" strokeWidth={1.5} />
      <Circle cx={12} cy={18} r={2} fill={color} stroke="none" />
    </Svg>
  );
}

export function PrayerIcon({ color, size = 24 }: TabIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Crescent finial atop the dome */}
      <Path d="M11 4a1.6 1.6 0 1 0 1.9 1.2" strokeWidth={1.5} />
      {/* Dome */}
      <Path d="M7 11a5 5 0 0 1 10 0" />
      {/* Building base */}
      <Path d="M5 21v-9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v9" />
      {/* Minaret line + arched entrance */}
      <Line x1={5} y1={21} x2={19} y2={21} />
      <Path d="M10 21v-3a2 2 0 0 1 4 0v3" strokeWidth={1.5} />
    </Svg>
  );
}

export function DownloadsIcon({ color, size = 24 }: TabIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Downward arrow */}
      <Line x1={12} y1={3} x2={12} y2={14} />
      <Path d="M8 10l4 4 4-4" />
      {/* Tray / baseline */}
      <Rect x={4} y={18} width={16} height={3} rx={1} />
    </Svg>
  );
}
