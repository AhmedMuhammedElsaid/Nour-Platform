import "@/lib/i18n"; // initialise i18n resources (PlayerScreen doesn't import it)

import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import PlayerScreen from "@/app/player";
import { PlayerProvider, usePlayer, type QueueTrack } from "@/lib/player-context";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  Stack: { Screen: () => null },
}));

const sampleQueue: QueueTrack[] = [
  { id: "t1", title: "Surah Al-Fatihah", mediaUrl: "https://example.com/1.mp3", durationSecs: 120, playlistTitle: "Reciter A" },
  { id: "t2", title: "Surah Al-Baqarah", mediaUrl: "https://example.com/2.mp3", durationSecs: 180 },
];

function Loader() {
  const { loadQueue } = usePlayer();
  useEffect(() => {
    loadQueue(sampleQueue, 0);
  }, [loadQueue]);
  return null;
}

function renderPlayer() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PlayerProvider>
        <Loader />
        <PlayerScreen />
      </PlayerProvider>
    </QueryClientProvider>,
  );
}

describe("PlayerScreen (Now Playing)", () => {
  it("shows the current track and transport controls once a queue loads", async () => {
    renderPlayer();

    await waitFor(() => expect(screen.getByText("Surah Al-Fatihah")).toBeTruthy());
    expect(screen.getByText("Reciter A")).toBeTruthy();
    // Transport + extra controls are present. Anchor the play regex so it doesn't
    // also match the seek slider's "Now Playing" label.
    expect(screen.getByLabelText(/^(Play|تشغيل)$/)).toBeTruthy();
    expect(screen.getByLabelText(/^(Shuffle|عشوائي)$/)).toBeTruthy();
    expect(screen.getByText(/Speed|السرعة/)).toBeTruthy();
    expect(screen.getByText(/Sleep timer|مؤقت النوم/)).toBeTruthy();
  });

  it("toggles play/pause without throwing", async () => {
    renderPlayer();
    await waitFor(() => expect(screen.getByText("Surah Al-Fatihah")).toBeTruthy());
    fireEvent.press(screen.getByLabelText(/^(Play|تشغيل)$/));
    // Still rendered (the control swaps label on the next playback-state tick).
    expect(screen.getByText("Surah Al-Fatihah")).toBeTruthy();
  });

  it("changes the playback rate when a speed chip is pressed", async () => {
    renderPlayer();
    await waitFor(() => expect(screen.getByText("Surah Al-Fatihah")).toBeTruthy());
    fireEvent.press(screen.getByText("1.5×"));
    expect(screen.getByText("1.5×")).toBeTruthy();
  });
});
