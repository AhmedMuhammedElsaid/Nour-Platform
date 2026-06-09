import "@/global.css";
import "@/lib/i18n";

import { useState } from "react";
import { View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import TrackPlayer from "react-native-track-player";

import { MiniPlayer } from "@/components/mini-player";
import { PlayerProvider } from "@/lib/player-context";
import { playbackService } from "@/lib/playback-service";

// Register the RNTP playback service once at module scope (must happen before
// the first render). This is the background event handler for lock-screen /
// notification transport controls.
TrackPlayer.registerPlaybackService(() => playbackService);

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <PlayerProvider>
        <View className="flex-1">
          <Stack screenOptions={{ headerShown: false }} />
          <MiniPlayer />
        </View>
      </PlayerProvider>
    </QueryClientProvider>
  );
}
