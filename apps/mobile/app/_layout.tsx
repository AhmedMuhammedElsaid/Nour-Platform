import "@/global.css";
import "@/lib/notifications"; // installs the foreground notification handler
import { hydrateLocale, initialLocale } from "@/lib/i18n";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { NavigationProgress } from "@/components/navigation-progress";
import { OnboardingGate } from "@/features/onboarding/components/onboarding-gate";
import { useOnboarding } from "@/features/onboarding/hooks/use-onboarding";
import { useAdhkarQuickActions } from "@/features/prayer-times/hooks/use-adhkar-quick-actions";
import { useAzkarNotificationRouter } from "@/features/prayer-times/hooks/use-azkar-notification-router";
import { useForegroundAdhan } from "@/features/prayer-times/hooks/use-foreground-adhan";
import { ThemeProvider } from "@/lib/theme-context";
import { PlayerProvider } from "@/lib/player-context";
import { playbackService } from "@/lib/playback-service";
import { runOfflinePrefetch } from "@/lib/offline-prefetch";
import appJson from "@/app.json";

// One month — how long a persisted query stays eligible for restore on cold
// start, and (as QueryClient's default gcTime below) how long an in-memory
// query survives without an active observer. gcTime must stay >= maxAge or
// the persisted cache could restore entries the in-memory client would have
// already garbage-collected.
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// Post-boot delay before background prefetch starts, so it never competes
// with first paint / the animated splash for the JS thread or the network.
const PREFETCH_DELAY_MS = 3000;

// Register the RNTP playback service once at module scope.
TrackPlayer.registerPlaybackService(() => playbackService);

// Prevent the splash screen from auto-hiding until fonts have loaded.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Keep unmounted queries alive in memory at least as long as the
            // persisted cache is allowed to restore them (see CACHE_MAX_AGE_MS).
            gcTime: CACHE_MAX_AGE_MS,
          },
        },
      }),
  );
  // AsyncStorage-backed persister for the query cache. Key is a MOBILE-ONLY
  // cache bucket (versioned so a future shape change can bump it) — it is NOT
  // one of the cross-surface `nour.*` device-local contracts (CLAUDE.md §5),
  // it never needs to match web localStorage or the extension's storage.
  const [persister] = useState(() =>
    createAsyncStoragePersister({
      storage: AsyncStorage,
      key: "nour.query.cache.v1",
    }),
  );
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
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: CACHE_MAX_AGE_MS,
          // Invalidates the persisted cache on an app version bump, so a data
          // shape change ships with a guaranteed-clean cache instead of a
          // stale/incompatible restore.
          buster: appJson.expo.version,
        }}
      >
        <ThemeProvider>
          <PlayerProvider>
            {localeReady && (
              <>
                <ForegroundAdhan />
                <AzkarNotificationRouter />
                <AdhkarQuickActions />
                <AzanScheduler />
                <OfflinePrefetchRunner queryClient={queryClient} />
                <Stack screenOptions={{ headerShown: false }} />
                <NavigationProgress />
                <BottomDock />
                {onboarding.hydrated && !onboarding.done && (
                  <OnboardingGate onComplete={onboarding.complete} />
                )}
              </>
            )}
          </PlayerProvider>
        </ThemeProvider>
        {!splashDone && <AnimatedSplash onFinish={() => setSplashDone(true)} />}
      </PersistQueryClientProvider>
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

// Renders nothing — kicks off the background Quran/adhkar offline prefetch a
// few seconds after boot (see PREFETCH_DELAY_MS), once per mount of this
// component (i.e. once per localeReady flip, which only happens on cold
// start). runOfflinePrefetch itself no-ops immediately if the completion
// marker already matches the current locale/reader prefs.
function OfflinePrefetchRunner({ queryClient }: { queryClient: QueryClient }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      void runOfflinePrefetch(queryClient, initialLocale);
    }, PREFETCH_DELAY_MS);
    return () => clearTimeout(timer);
    // queryClient is a stable ref from useState(() => ...) in the parent
    // (included below only to satisfy exhaustive-deps); initialLocale is a
    // module-level snapshot already resolved by hydrateLocale() before this
    // mounts (localeReady gate), so it's intentionally not a dep.
  }, [queryClient]);
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
