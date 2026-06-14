// A minimal, dependency-free slider (seek bar / volume). The community slider is
// a native module that would force an EAS rebuild, so this is built on RN core's
// PanResponder + a measured track width — pure JS, works in the current dev
// client. Track is laid out LTR; the audio time/volume axis is conventionally
// LTR even in an RTL UI.

import { useRef, useState } from "react";
import { PanResponder, View } from "react-native";

type SliderProps = {
  value: number;
  max: number;
  min?: number;
  // Live updates while dragging (e.g. volume, which is applied immediately).
  onValueChange?: (value: number) => void;
  // Commit on release (e.g. seek, which we only apply once to avoid scrub lag).
  onSlidingComplete?: (value: number) => void;
  accessibilityLabel?: string;
};

export function Slider({
  value,
  max,
  min = 0,
  onValueChange,
  onSlidingComplete,
  accessibilityLabel,
}: SliderProps) {
  const widthRef = useRef(0);
  const trackLeftRef = useRef(0);
  const [dragFrac, setDragFrac] = useState<number | null>(null);

  const fracFromPageX = (pageX: number): number => {
    const w = widthRef.current;
    if (w <= 0) return 0;
    return Math.max(0, Math.min(1, (pageX - trackLeftRef.current) / w));
  };
  const toValue = (frac: number): number => min + frac * (max - min);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        // pageX - locationX is the track's absolute left edge at grant time.
        trackLeftRef.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
        const f = fracFromPageX(e.nativeEvent.pageX);
        setDragFrac(f);
        onValueChange?.(toValue(f));
      },
      onPanResponderMove: (e) => {
        const f = fracFromPageX(e.nativeEvent.pageX);
        setDragFrac(f);
        onValueChange?.(toValue(f));
      },
      onPanResponderRelease: (e) => {
        const f = fracFromPageX(e.nativeEvent.pageX);
        setDragFrac(null);
        onSlidingComplete?.(toValue(f));
      },
      onPanResponderTerminate: () => setDragFrac(null),
    }),
  ).current;

  const frac = dragFrac ?? (max > min ? (value - min) / (max - min) : 0);
  const pctNum = Math.max(0, Math.min(1, frac)) * 100;

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 12, bottom: 12 }}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
      }}
      className="h-6 justify-center"
      {...pan.panHandlers}
    >
      <View className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        {/* Inline template literal so TS contextually types it as a percentage
            DimensionValue (an intermediate const widens to plain string). */}
        <View className="h-full rounded-full bg-primary" style={{ width: `${pctNum}%` }} />
      </View>
      {/* Thumb */}
      <View
        pointerEvents="none"
        className="absolute size-4 rounded-full bg-primary"
        style={{ left: `${pctNum}%`, marginLeft: -8 }}
      />
    </View>
  );
}
