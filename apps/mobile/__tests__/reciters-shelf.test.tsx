import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { QuranReciter } from "@repo/shared-core/schemas/quran";

import { RecitersShelf } from "@/features/home/components/reciters-shelf";
import { getJson } from "@/lib/api";
import { getQuranPrefs, setQuranPrefs, DEFAULT_QURAN_PREFS } from "@/lib/device-local";

jest.mock("@/lib/api", () => ({
  getJson: jest.fn(),
  assetUrl: (p: string) => `http://localhost:3000${p}`,
}));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/lib/device-local", () => ({
  getQuranPrefs: jest.fn(),
  setQuranPrefs: jest.fn(),
  DEFAULT_QURAN_PREFS: {
    translationSlug: "",
    reciterSlug: "alafasy",
    showTranslation: true,
    showWordByWord: false,
    fontScale: 1,
  },
}));
const mockLoadQueue = jest.fn();
jest.mock("@/lib/player-context", () => ({ usePlayer: () => ({ loadQueue: mockLoadQueue }) }));

const reciter = (over: Partial<QuranReciter> & Pick<QuranReciter, "slug" | "name">): QuranReciter =>
  ({ audioBase: "https://everyayah.com/x/", ...over }) as QuranReciter;

function renderShelf() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RecitersShelf />
    </QueryClientProvider>,
  );
}

describe("RecitersShelf", () => {
  beforeEach(() => {
    jest.mocked(getJson).mockReset();
    mockPush.mockReset();
    mockLoadQueue.mockReset();
    jest.mocked(setQuranPrefs).mockReset().mockResolvedValue(undefined);
    jest.mocked(getQuranPrefs).mockReset().mockResolvedValue(DEFAULT_QURAN_PREFS);
  });

  it("renders fetched reciter names", async () => {
    jest.mocked(getJson).mockResolvedValue([
      reciter({ slug: "alafasy", name: "Mishary Alafasy" }),
      reciter({ slug: "sudais", name: "Abdurrahman Al-Sudais" }),
    ]);
    renderShelf();
    await waitFor(() => expect(screen.getByText("Mishary Alafasy")).toBeTruthy());
    expect(screen.getByText("Abdurrahman Al-Sudais")).toBeTruthy();
  });

  it("writes the tapped reciter to prefs, plays Al-Fatiha in the background, and opens the surah list", async () => {
    jest.mocked(getJson).mockImplementation((path: string) => {
      if (path === "/quran/surah/1") {
        return Promise.resolve({
          ayahs: [{ ayahInSurah: 1, audioUrl: "https://everyayah.com/1.mp3" }],
        });
      }
      return Promise.resolve([reciter({ slug: "sudais", name: "Al-Sudais" })]);
    });
    renderShelf();
    const item = await screen.findByText("Al-Sudais");
    fireEvent.press(item);
    await waitFor(() =>
      expect(setQuranPrefs).toHaveBeenCalledWith(
        expect.objectContaining({ reciterSlug: "sudais" }),
      ),
    );
    await waitFor(() =>
      expect(mockLoadQueue).toHaveBeenCalledWith(
        [expect.objectContaining({ id: "quran:1:1", mediaUrl: "https://everyayah.com/1.mp3" })],
        0,
      ),
    );
    // No autoplay query param — playback comes from the shared player, not the reader.
    expect(mockPush).toHaveBeenCalledWith("/quran");
  });
});
