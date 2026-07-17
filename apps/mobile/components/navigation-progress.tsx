// Global top trickle bar driven by TanStack Query network activity. Mobile
// navigation itself (expo-router) is instant — the perceived delay is data
// fetching on the destination screen, so unlike web (which watches route
// changes) this watches `useIsFetching()` directly. Mirrors nprogress-style
// behaviour: jump in, trickle toward a ceiling, snap to 100% + fade on
// completion. Plain RN `Animated` (not Reanimated) — a two-value trickle
// doesn't need the worklet thread.

import { useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import { useIsFetching } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Debounce before showing the bar so a cache-hit fetch (resolves in a few ms)
// never flickers it on screen.
const SHOW_DELAY_MS = 150;
// Trickle never reaches 100% on its own — only a completed fetch (isFetching
// back to 0) pushes it the rest of the way, like nprogress.
const TRICKLE_CEILING = 0.85;
const TRICKLE_STEP = 0.05;
const TRICKLE_INTERVAL_MS = 300;
const FINISH_DURATION_MS = 200;
const FADE_DURATION_MS = 250;
const BAR_HEIGHT = 2;

export function NavigationProgress() {
  const isFetching = useIsFetching();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors `visible` for the effect below to read synchronously without
  // depending on `visible` itself (which would re-run the effect on every
  // show/hide instead of only when isFetching flips).
  const visibleRef = useRef(false);

  useEffect(() => {
    const clearShowTimer = () => {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
    };
    const clearTrickle = () => {
      if (trickleRef.current) {
        clearInterval(trickleRef.current);
        trickleRef.current = null;
      }
    };

    if (isFetching > 0) {
      clearShowTimer();
      showTimerRef.current = setTimeout(() => {
        visibleRef.current = true;
        setVisible(true);
        progress.setValue(0.15);
        opacity.setValue(1);
        clearTrickle();
        trickleRef.current = setInterval(() => {
          progress.stopAnimation((current) => {
            if (current >= TRICKLE_CEILING) return;
            Animated.timing(progress, {
              toValue: Math.min(current + TRICKLE_STEP, TRICKLE_CEILING),
              duration: TRICKLE_INTERVAL_MS,
              easing: Easing.out(Easing.ease),
              useNativeDriver: false,
            }).start();
          });
        }, TRICKLE_INTERVAL_MS);
      }, SHOW_DELAY_MS);
    } else {
      clearShowTimer();
      clearTrickle();
      // Only run the finish/fade sequence if the bar actually made it on
      // screen — a fetch that resolves inside the show-delay window never
      // rendered anything, so there's nothing to complete.
      if (visibleRef.current) {
        Animated.timing(progress, {
          toValue: 1,
          duration: FINISH_DURATION_MS,
          useNativeDriver: false,
        }).start(() => {
          Animated.timing(opacity, {
            toValue: 0,
            duration: FADE_DURATION_MS,
            useNativeDriver: false,
          }).start(() => {
            visibleRef.current = false;
            setVisible(false);
          });
        });
      }
    }

    return () => {
      clearShowTimer();
      clearTrickle();
    };
  }, [isFetching, progress, opacity]);

  if (!visible) return null;

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID="navigation-progress"
      style={{
        position: "absolute",
        top: insets.top,
        left: 0,
        right: 0,
        height: BAR_HEIGHT,
        opacity,
        zIndex: 60,
      }}
    >
      <Animated.View
        className="h-full bg-primary"
        style={{
          width: progress.interpolate({
            inputRange: [0, 1],
            outputRange: ["0%", "100%"],
          }),
        }}
      />
    </Animated.View>
  );
}
