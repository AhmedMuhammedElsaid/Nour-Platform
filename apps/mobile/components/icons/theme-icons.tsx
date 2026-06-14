// Sun/moon icons for the theme toggle, drawn with react-native-svg in the same
// stroke style as components/icons/tab-icons.tsx (24x24 viewBox, 2px round
// strokes, explicit `color` prop because SVG can't read NativeWind classes).
// Replaces the ☀/☾ emoji glyphs, which rendered tiny and unthemed (point 26).

import Svg, { Circle, Line, Path } from "react-native-svg";

type ThemeIconProps = { color: string; size?: number; testID?: string };

export function SunIcon({ color, size = 24, testID }: ThemeIconProps) {
  return (
    <Svg
      testID={testID}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Core disc + eight rays */}
      <Circle cx={12} cy={12} r={4} />
      <Line x1={12} y1={2} x2={12} y2={4.5} />
      <Line x1={12} y1={19.5} x2={12} y2={22} />
      <Line x1={2} y1={12} x2={4.5} y2={12} />
      <Line x1={19.5} y1={12} x2={22} y2={12} />
      <Line x1={4.9} y1={4.9} x2={6.6} y2={6.6} />
      <Line x1={17.4} y1={17.4} x2={19.1} y2={19.1} />
      <Line x1={19.1} y1={4.9} x2={17.4} y2={6.6} />
      <Line x1={6.6} y1={17.4} x2={4.9} y2={19.1} />
    </Svg>
  );
}

export function MoonIcon({ color, size = 24, testID }: ThemeIconProps) {
  return (
    <Svg
      testID={testID}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Crescent — a disc with a bite taken out of its upper-right */}
      <Path d="M20 14.5A8 8 0 1 1 9.5 4 6.2 6.2 0 0 0 20 14.5z" />
    </Svg>
  );
}
