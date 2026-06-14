// Player, download, and utility icons — stroke-based SVG following the
// tab-icons.tsx pattern: 24x24 viewBox, no fill, color prop for stroke.

import Svg, { Line, Path, Rect } from "react-native-svg";

type IconProps = { color: string; size?: number };

// Transport controls
export function PrevIcon({ color, size = 24 }: IconProps) {
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
      <Line x1={6} y1={4} x2={6} y2={20} />
      <Path d="M20 4l-12 8 12 8z" />
    </Svg>
  );
}

export function PlayIcon({ color, size = 24 }: IconProps) {
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
      <Path d="M5 3l14 9-14 9z" />
    </Svg>
  );
}

export function PauseIcon({ color, size = 24 }: IconProps) {
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
      <Rect x={6} y={3} width={3} height={18} rx={0.5} />
      <Rect x={15} y={3} width={3} height={18} rx={0.5} />
    </Svg>
  );
}

export function NextIcon({ color, size = 24 }: IconProps) {
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
      <Line x1={18} y1={4} x2={18} y2={20} />
      <Path d="M4 4l12 8-12 8z" />
    </Svg>
  );
}

// Repeat / shuffle
export function RepeatIcon({ color, size = 24 }: IconProps) {
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
      <Path d="M17 2l4 4-4 4" />
      <Path d="M3 11a4 4 0 0 1 4-4h10" />
      <Path d="M7 22l-4-4 4-4" />
      <Path d="M21 13a4 4 0 0 1-4 4H7" />
    </Svg>
  );
}

export function RepeatOneIcon({ color, size = 24 }: IconProps) {
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
      <Path d="M17 2l4 4-4 4" />
      <Path d="M3 11a4 4 0 0 1 4-4h10" />
      <Path d="M7 22l-4-4 4-4" />
      <Path d="M21 13a4 4 0 0 1-4 4H7" />
      {/* Numeral "1" centered in the loop */}
      <Path d="M10 13h1v4h-1" strokeWidth={1.5} fill={color} stroke="none" />
    </Svg>
  );
}

export function ShuffleIcon({ color, size = 24 }: IconProps) {
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
      <Path d="M4 4h4v4" />
      <Path d="M4 4l5 5" />
      <Path d="M16 20h4v-4" />
      <Path d="M20 20l-5-5" />
      <Line x1={4} y1={20} x2={20} y2={4} strokeWidth={2} />
    </Svg>
  );
}

// Download / check / retry
export function CheckIcon({ color, size = 24 }: IconProps) {
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
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  );
}

export function RetryIcon({ color, size = 24 }: IconProps) {
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
      <Path d="M23 4v6h-6" />
      <Path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </Svg>
  );
}

export function DownloadIcon({ color, size = 24 }: IconProps) {
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
      <Line x1={12} y1={3} x2={12} y2={14} />
      <Path d="M8 10l4 4 4-4" />
      <Rect x={4} y={18} width={16} height={3} rx={1} />
    </Svg>
  );
}

// Volume / audio
export function VolumeIcon({ color, size = 24 }: IconProps) {
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
      <Path d="M3 9v6" />
      <Path d="M5 7v10" />
      <Path d="M9 4v16" />
      <Path d="M13 7v10" />
      <Path d="M17 9v6" />
      <Path d="M21 11v2" />
    </Svg>
  );
}

export function MuteIcon({ color, size = 24 }: IconProps) {
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
      <Line x1={3} y1={3} x2={21} y2={21} />
      <Path d="M3 9v6" />
      <Path d="M5 7v10" />
      <Path d="M9 4v16" />
      <Path d="M13 7v10" />
      <Path d="M17 9v6" />
    </Svg>
  );
}

// Navigation
export function ChevronDownIcon({ color, size = 24 }: IconProps) {
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
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  );
}
