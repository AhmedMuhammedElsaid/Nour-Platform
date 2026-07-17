import "@/global.css";
import "@/lib/notifications"; // installs the foreground notification handler
import { hydrateLocale } from "@/lib/i18n";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import TrackPlayer from "react-native-track-player";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

import { AnimatedSplash } from "@/components/animated-splash";
import { AzanScheduler } from "@/components/azan-scheduler";
import { BottomDock } from "@/components/bottom-dock";
import { OnboardingGate } from "@/features/onboarding/components/onboarding-gate";
import { useOnboarding } from "@/features/onboarding/hooks/use-onboarding";
import { useAdhkarQuickActions } from "@/features/prayer-times/hooks/use-adhkar-quick-actions";
import { useAzkarNotificationRouter } from "@/features/prayer-times/hooks/use-azkar-notification-router";
import { useForegroundAdhan } from "@/features/prayer-times/hooks/use-foreground-adhan";
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
  // Hold the app tree until the persisted locale is applied, so the first render
  // (and the data queries keyed on `initialLocale`) use the user's language, not
  // the device default. The splash overlay covers this sub-frame delay.
  const [localeReady, setLocaleReady] = useState(false);
  const onboarding = useOnboarding();

  // Load custom fonts. Falls back to system fonts if the .ttf assets are not
  // bundled (acceptable in development; add @expo-google-fonts packages for a
  // production EAS build or bundle the .ttf files under assets/fonts/).
  const [fontsLoaded] = useFonts({});

  useEffect(() => {
    void hydrateLocale().then(() => setLocaleReady(true));
  }, []);

  useEffect(() => {
    // Hide splash once fonts are done (or immediately if none to load).
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <PlayerProvider>
            {localeReady && (
              <>
                <ForegroundAdhan />
                <AzkarNotificationRouter />
                <AdhkarQuickActions />
                <AzanScheduler />
                <Stack screenOptions={{ headerShown: false }} />
                <BottomDock />
                {onboarding.hydrated && !onboarding.done && (
                  <OnboardingGate onComplete={onboarding.complete} />
                )}
              </>
            )}
          </PlayerProvider>
        </ThemeProvider>
        {!splashDone && <AnimatedSplash onFinish={() => setSplashDone(true)} />}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

// Mounted inside PlayerProvider so the foreground adhan can duck the RNTP queue.
// Renders nothing — it only wires the azan notification → full-adhan listener.
function ForegroundAdhan() {
  useForegroundAdhan();
  return null;
}

// Renders nothing — deep-links an azkar-reminder notification tap (warm or
// cold start) to the adhkar reader screen.
function AzkarNotificationRouter() {
  useAzkarNotificationRouter();
  return null;
}

// Renders nothing — registers the Sabah/Masaa launcher shortcuts and routes
// their taps to the adhkar reader.
function AdhkarQuickActions() {
  useAdhkarQuickActions();
  return null;
}

// Root error boundary. expo-router mounts this automatically when any child
// route (or its render) throws, converting what would be a native white-screen
// crash on a release build into a themed, recoverable screen. Belt-and-braces
// for the embedded-locale dereferences: a malformed API row white-screens the
// affected screen instead of the whole app, and the user can retry.
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-bg px-6">
      <Text variant="display" className="text-2xl">
        {t("common.error")}
      </Text>
      <Button label={t("common.retry")} variant="outline" onPress={retry} />
    </View>
  );
}
