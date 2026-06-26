import { useCallback, useEffect, useRef } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";

import { Text } from "@/components/ui/text";

// Brand colors mirrored from packages/ui/src/styles/tokens.css (dark palette).
// SVG fills + animated styles can't use NativeWind classes — same local-const
// pattern as features/prayer-times/components/sun-arc.tsx.
const BG = "#0f0d0a"; // --color-bg (near-black canvas)
const GOLD = "#c8a050"; // --color-primary (noon stroke + bloom)
const SUN = "#e4c57e"; // --color-sun (brighter gold for the dot + shimmer)

// "Minimal Rise" — the ن mark springs up out of a soft gold bloom, a gloss
// shimmer wipes across it, then the wordmark rises in. Plays once on cold start
// as a JS overlay above the native splash, then fades out and unmounts.
type AnimatedSplashProps = {
  /** Called once the exit fade completes (or the safety timeout fires). */
  onFinish: () => void;
};

export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const overlay = useSharedValue(1);
  const bloomOpacity = useSharedValue(0);
  const bloomScale = useSharedValue(0.6);
  const markOpacity = useSharedValue(0);
  const markScale = useSharedValue(0.85);
  const markY = useSharedValue(8);
  const shimmerX = useSharedValue(-110);
  const wordOpacity = useSharedValue(0);
  const wordY = useSharedValue(12);

  // Guard so the exit-fade callback and the safety timeout can't both fire it.
  const done = useRef(false);
  const finishOnce = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onFinish();
  }, [onFinish]);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const exit = () => {
      if (cancelled) return;
      overlay.value = withTiming(
        0,
        { duration: 280, easing: Easing.in(Easing.quad) },
        (finished) => {
          if (finished) runOnJS(finishOnce)();
        },
      );
    };

    const run = (reduceMotion: boolean) => {
      if (cancelled) return;

      if (reduceMotion) {
        // Honour the OS setting: present the final frame with no movement.
        bloomOpacity.value = 0.4;
        bloomScale.value = 1;
        markOpacity.value = 1;
        markScale.value = 1;
        markY.value = 0;
        wordOpacity.value = 1;
        wordY.value = 0;
        timers.push(setTimeout(exit, 700));
        return;
      }

      bloomOpacity.value = withTiming(0.5, {
        duration: 700,
        easing: Easing.out(Easing.quad),
      });
      bloomScale.value = withTiming(1, {
        duration: 900,
        easing: Easing.out(Easing.cubic),
      });
      markOpacity.value = withTiming(1, {
        duration: 360,
        easing: Easing.out(Easing.quad),
      });
      markScale.value = withSpring(1, { damping: 12, stiffness: 130, mass: 0.9 });
      markY.value = withSpring(0, { damping: 14, stiffness: 120 });
      shimmerX.value = withDelay(
        420,
        withTiming(110, { duration: 680, easing: Easing.inOut(Easing.ease) }),
      );
      wordOpacity.value = withDelay(
        560,
        withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }),
      );
      wordY.value = withDelay(
        560,
        withTiming(0, { duration: 480, easing: Easing.out(Easing.cubic) }),
      );
      timers.push(setTimeout(exit, 1280));
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .then(run)
      .catch(() => run(false));

    // Safety net: never trap the user on the splash if an animation stalls.
    timers.push(setTimeout(finishOnce, 2600));

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // Shared values are stable refs; finishOnce is the only reactive dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishOnce]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));
  const bloomStyle = useAnimatedStyle(() => ({
    opacity: bloomOpacity.value,
    transform: [{ scale: bloomScale.value }],
  }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [{ scale: markScale.value }, { translateY: markY.value }],
  }));
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }, { rotate: "18deg" }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: wordOpacity.value,
    transform: [{ translateY: wordY.value }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]}>
      <View style={styles.center}>
        <View style={styles.markArea}>
          {/* Soft radial gold bloom behind the mark (SVG gradient = real glow). */}
          <Animated.View style={[styles.bloom, bloomStyle]}>
            <Svg width={224} height={224} viewBox="0 0 100 100">
              <Defs>
                <RadialGradient id="nour-bloom" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor={GOLD} stopOpacity={0.55} />
                  <Stop offset="45%" stopColor={GOLD} stopOpacity={0.2} />
                  <Stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx="50" cy="50" r="50" fill="url(#nour-bloom)" />
            </Svg>
          </Animated.View>

          {/* Mark + gloss shimmer, clipped to the box so the shimmer wipes through. */}
          <View style={styles.markBox} accessibilityLabel="Nour">
            <Animated.View style={markStyle}>
              <Svg width={104} height={104} viewBox="0 0 512 512">
                {/* Stylised Arabic ن (noon) with its dot — the brand mark. */}
                <Path
                  d="M150 196v44c0 64 47 104 106 104s106-40 106-104v-44"
                  fill="none"
                  stroke={GOLD}
                  strokeWidth={34}
                  strokeLinecap="round"
                />
                <Circle cx={256} cy={150} r={22} fill={SUN} />
              </Svg>
            </Animated.View>
            <Animated.View style={[styles.shimmer, shimmerStyle]} />
          </View>
        </View>

        <Animated.View style={[styles.word, wordStyle]}>
          <Text variant="display" className="text-primary" style={styles.arabic}>
            نور
          </Text>
          <Text variant="label" className="mt-2 text-text-2">
            Nour Platform
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    elevation: 100,
  },
  center: { alignItems: "center" },
  markArea: {
    width: 224,
    height: 224,
    alignItems: "center",
    justifyContent: "center",
  },
  bloom: { position: "absolute", alignItems: "center", justifyContent: "center" },
  markBox: {
    width: 132,
    height: 132,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  shimmer: {
    position: "absolute",
    top: -30,
    bottom: -30,
    width: 26,
    backgroundColor: SUN,
    opacity: 0.22,
  },
  word: { alignItems: "center", marginTop: 18 },
  arabic: { fontSize: 40, lineHeight: 52 },
});
