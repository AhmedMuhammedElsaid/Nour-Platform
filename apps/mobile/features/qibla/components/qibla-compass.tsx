// Qibla compass — a WebView hosting the exact same browser compass the web `/qibla`
// page uses (deviceorientationabsolute / webkitCompassHeading + a GPU CSS rotate).
// The user confirmed the web compass is smooth + accurate on their device; native
// expo sensors could not match it (uncalibrated "accuracy 0" magnetometer;
// DeviceMotion is relative on Android). Reusing the browser pipeline is the
// deterministic way to get web parity. See docs/adr/0010-webview-qibla-compass.md.

import { memo, useCallback } from "react";
import { View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import type { ThemeMode } from "@/lib/theme-context";
import { compassHtml, type CompassPalette } from "../lib/compass-html";

const PALETTES: Record<ThemeMode, CompassPalette> = {
  dark: {
    gold: "#c8a050",
    sun: "#e4c57e",
    muted: "#8a7a62",
    surface: "#1c1915",
    surface2: "#252018",
    border: "rgba(200,160,80,0.15)",
  },
  light: {
    gold: "#9a7830",
    sun: "#c8a050",
    muted: "#3f4a44",
    surface: "#ffffff",
    surface2: "#f4f1e8",
    border: "#e6e2d7",
  },
};

export type QiblaCompassState = {
  heading?: number;
  aligned: boolean;
  live: boolean;
};

export type QiblaCompassProps = {
  bearing: number;
  theme?: ThemeMode;
  // Reports heading/alignment/availability from the WebView (throttled) so the
  // screen can show the "facing Qibla" text + calibration nudge.
  onState?: (state: QiblaCompassState) => void;
};

export const QiblaCompass = memo(function QiblaCompass({
  bearing,
  theme = "dark",
  onState,
}: QiblaCompassProps) {
  const html = compassHtml(bearing, PALETTES[theme]);

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      if (!onState) return;
      try {
        const d = JSON.parse(e.nativeEvent.data) as Partial<QiblaCompassState>;
        onState({ heading: d.heading, aligned: !!d.aligned, live: !!d.live });
      } catch {
        // Ignore malformed messages.
      }
    },
    [onState],
  );

  return (
    <View style={{ width: "100%", aspectRatio: 1, maxWidth: 320, alignSelf: "center" }}>
      <WebView
        testID="qibla-webview"
        originWhitelist={["*"]}
        source={{ html }}
        style={{ flex: 1, backgroundColor: PALETTES[theme].surface }}
        // Hardware layer so the CSS rotation is GPU-composited (smooth). The HTML
        // background matches the card, so no transparency (which would force the
        // slow software layer on Android).
        androidLayerType="hardware"
        scrollEnabled={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        onMessage={onMessage}
      />
    </View>
  );
});
