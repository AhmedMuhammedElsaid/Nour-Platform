import { useCallback, useEffect, useRef } from "react";
import { AccessibilityInfo, Image, StyleSheet } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

// Brand canvas mirrored from packages/ui/src/styles/tokens.css (dark palette).
const BG = "#0f0d0a"; // --color-bg (near-black canvas, matches the native splash)

// The app icon (the og-image Quran scene) springs+fades in over the native
// splash, holds a beat, then the overlay fades out and unmounts. Continues the
// native splash seamlessly (same image, same bg) and smooths the hand-off to
// the app. The icon already carries the "Nour Platform" wordmark, so there is
// no separate text layer. Plays once on cold start.
type AnimatedSplashProps = {
  /** Called once the exit fade completes (or the safety timeout fires). */
  onFinish: () => void;
};

export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const overlay = useSharedValue(1);
  const iconOpacity = useSharedValue(0);
  const iconScale = useSharedValue(0.85);
  const iconY = useSharedValue(8);

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
        iconOpacity.value = 1;
        iconScale.value = 1;
        iconY.value = 0;
        timers.push(setTimeout(exit, 700));
        return;
      }

      iconOpacity.value = withTiming(1, {
        duration: 420,
        easing: Easing.out(Easing.quad),
      });
      iconScale.value = withSpring(1, { damping: 12, stiffness: 130, mass: 0.9 });
      iconY.value = withSpring(0, { damping: 14, stiffness: 120 });
      timers.push(setTimeout(exit, 1200));
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
    // (react-hooks/exhaustive-deps is not configured in this app.)
  }, [finishOnce]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));
  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ scale: iconScale.value }, { translateY: iconY.value }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]}>
      <Animated.View style={iconStyle}>
        <Image
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          source={require("../assets/icon.png")}
          style={styles.icon}
          resizeMode="contain"
          accessibilityLabel="Nour"
        />
      </Animated.View>
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
  icon: { width: 240, height: 240 },
});
