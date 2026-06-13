import "@/global.css";
import "@/lib/i18n";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import TrackPlayer from "react-native-track-player";

import { AnimatedSplash } from "@/components/animated-splash";
import { MiniPlayer } from "@/components/mini-player";
import { ThemeProvider } from "@/lib/theme-context";
import { PlayerProvider } from "@/lib/player-context";
import { playbackService } from "@/lib/playback-service";

// Register the RNTP playback service once at module scope.
TrackPlayer.registerPlaybackService(() => playbackService);

// Prevent the splash screen from auto-hiding until fonts have loaded.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  // Animated brand splash overlays the app on cold start, then unmounts itself.
  const [splashDone, setSplashDone] = useState(false);

  // Load custom fonts. Falls back to system fonts if the .ttf assets are not
  // bundled (acceptable in development; add @expo-google-fonts packages for a
  // production EAS build or bundle the .ttf files under assets/fonts/).
  const [fontsLoaded] = useFonts({});

  useEffect(() => {
    // Hide splash once fonts are done (or immediately if none to load).
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <PlayerProvider>
          <Stack screenOptions={{ headerShown: false }} />
          <MiniPlayer />
        </PlayerProvider>
      </ThemeProvider>
      {!splashDone && <AnimatedSplash onFinish={() => setSplashDone(true)} />}
    </QueryClientProvider>
  );
}
