// True while the calling screen is focused AND the app is in the foreground.
//
// Screens in this app are NOT unmounted when you navigate away — the router
// stack keeps them alive so back-navigation is instant — so "is mounted" is a
// poor proxy for "is visible". Anything that costs something per frame or per
// tick (animation loops, timers) should gate on this instead, or it keeps
// burning work for a screen the user left minutes ago.
//
// Must be called from a component under the navigator (useFocusEffect), which
// is why presentational components take the result as a prop rather than
// calling this themselves.

import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState } from "react-native";

export function useScreenActive(): boolean {
  const [active, setActive] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setActive(AppState.currentState === "active");
      const sub = AppState.addEventListener("change", (state) => {
        setActive(state === "active");
      });
      return () => {
        sub.remove();
        setActive(false);
      };
    }, []),
  );

  return active;
}
