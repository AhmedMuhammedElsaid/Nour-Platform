import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import { File as FSFile } from "expo-file-system";

import DownloadsScreen from "@/app/downloads";
import PlaylistDetailScreen from "@/app/playlist/[slug]";
import { getJson } from "@/lib/api";
import { PlayerProvider } from "@/lib/player-context";

jest.mock("@/lib/api", () => ({ getJson: jest.fn() }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useLocalSearchParams: () => ({ slug: "test-playlist" }),
  usePathname: () => "/playlist/test-playlist",
  Stack: { Screen: () => null },
}));

const playlist = {
  id: "pl1",
  ar: { title: "اختبار", slug: "اختبار", description: null, scholarName: null },
  en: { title: "Test Playlist", slug: "test-playlist", description: null, scholarName: null },
  status: "published",
  categoryIds: [],
  order: 0,
};

const track = {
  id: "tr1",
  ar: { title: "مقطع واحد", slug: "مقطع-واحد", description: null },
  en: { title: "Track One", slug: "track-one", description: null },
  mediaId: "m1",
  playlistId: "pl1",
  order: 0,
  srcUrl: "https://cdn.example.com/tr1.mp3",
};

function mockApi() {
  (jest.mocked(getJson) as jest.Mock).mockImplementation((path: string) => {
    if (path === "/playlists/test-playlist") return Promise.resolve({ playlist, tracks: [track] });
    if (path === "/categories") return Promise.resolve([]);
    return Promise.resolve([]);
  });
}

function renderWith(node: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Both the downloads list and the playlist detail now read the player context.
  return render(
    <QueryClientProvider client={client}>
      <PlayerProvider>{node}</PlayerProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  jest.mocked(getJson).mockReset();
  await AsyncStorage.clear();
});

describe("DownloadsScreen", () => {
  it("shows empty state when no downloads exist", async () => {
    renderWith(<DownloadsScreen />);
    await waitFor(() =>
      expect(screen.getByText(/No downloads yet/i)).toBeTruthy(),
    );
  });

  it("shows a downloaded track after it is saved to AsyncStorage", async () => {
    await AsyncStorage.setItem(
      "nour.downloads",
      JSON.stringify([
        {
          trackId: "tr1",
          title: "Track One",
          playlistTitle: "Test Playlist",
          localPath: "file:///test/nour-audio/tr1.mp3",
          sizeBytes: 1024 * 1024,
          downloadedAt: Date.now(),
        },
      ]),
    );

    renderWith(<DownloadsScreen />);
    await waitFor(() => expect(screen.getByText("Track One")).toBeTruthy());
    expect(screen.getByText("Test Playlist")).toBeTruthy();
  });
});

describe("PlaylistDetailScreen — download buttons", () => {
  it("shows a download button for each playable track", async () => {
    mockApi();
    renderWith(<PlaylistDetailScreen />);
    await waitFor(() => expect(screen.getByText("Track One")).toBeTruthy());

    // DownloadButton renders with aria-label "Download Track One"
    const btn = screen.getByLabelText(/Download Track One/i);
    expect(btn).toBeTruthy();
  });

  it("triggers downloadFileAsync when download button is pressed", async () => {
    mockApi();
    renderWith(<PlaylistDetailScreen />);
    await waitFor(() => expect(screen.getByText("Track One")).toBeTruthy());

    const btn = screen.getByLabelText(/Download Track One/i);
    fireEvent.press(btn);

    await waitFor(() =>
      expect(FSFile.downloadFileAsync).toHaveBeenCalledWith(
        track.srcUrl,
        expect.objectContaining({ uri: expect.stringContaining("tr1.mp3") }),
        expect.objectContaining({ idempotent: true }),
      ),
    );
  });
});
