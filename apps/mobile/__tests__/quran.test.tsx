import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";

import QuranIndexScreen from "@/app/quran/index";
import QuranReaderScreen from "@/app/quran/[surah]";
import { getJson } from "@/lib/api";
import { PlayerProvider } from "@/lib/player-context";

jest.mock("@/lib/api", () => ({ getJson: jest.fn() }));

// A controllable ayah-audio player so we can assert playback is stopped when the
// reader leaves. `mock`-prefixed names are allowed through jest's hoisting.
const mockPlayer = {
  replace: jest.fn(),
  play: jest.fn(),
  pause: jest.fn(),
  remove: jest.fn(),
};
jest.mock("expo-audio", () => ({
  useAudioPlayer: () => mockPlayer,
  useAudioPlayerStatus: () => ({ playing: false, didJustFinish: false }),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

// Model useFocusEffect as a mount-run effect whose cleanup fires on blur/unmount
// (matches @react-navigation semantics for the case under test).
jest.mock("expo-router", () => {
  const react = jest.requireActual("react") as typeof import("react");
  return {
    useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
    useLocalSearchParams: () => ({ surah: "1" }),
    usePathname: () => "/quran",
    useFocusEffect: (cb: () => void | (() => void)) => react.useEffect(cb, []),
    Stack: { Screen: () => null },
  };
});

const surah = {
  number: 1,
  name: { ar: "الفاتحة", en: "Al-Fatihah" },
  meaning: "The Opening",
  revelationPlace: "meccan",
  ayahCount: 7,
  pageStart: 1,
  pageEnd: 1,
  bismillahPre: true,
};

const reader = {
  surah,
  ayahs: [
    {
      surah: 1,
      ayahInSurah: 1,
      numberGlobal: 1,
      juz: 1,
      page: 1,
      sajda: false,
      textUthmani: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
      words: [],
      translation: "In the name of Allah, the Most Gracious, the Most Merciful.",
      audioUrl: "https://everyayah.com/data/Alafasy_128kbps/001001.mp3",
    },
  ],
  translationEdition: { slug: "en.sahih", language: "en", name: "Sahih International", author: "x", type: "translation", dir: "ltr" },
  reciter: { slug: "alafasy", name: "Alafasy", audioBase: "https://everyayah.com/data/Alafasy_128kbps/" },
};

function mockApi() {
  (jest.mocked(getJson) as jest.Mock).mockImplementation((path: string) => {
    if (path === "/quran/surahs") return Promise.resolve([surah]);
    if (path.startsWith("/quran/surah/")) return Promise.resolve(reader);
    if (path === "/quran/editions") return Promise.resolve([reader.translationEdition]);
    if (path === "/quran/reciters") return Promise.resolve([reader.reciter]);
    return Promise.resolve([]);
  });
}

function renderWith(node: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PlayerProvider>{node}</PlayerProvider>
    </QueryClientProvider>,
  );
}

describe("QuranIndexScreen", () => {
  beforeEach(() => jest.mocked(getJson).mockReset());

  it("renders the surah list", async () => {
    mockApi();
    renderWith(<QuranIndexScreen />);
    await waitFor(() => expect(screen.getByText("Al-Fatihah")).toBeTruthy());
  });

  it("shows an error state on failure", async () => {
    (jest.mocked(getJson) as jest.Mock).mockRejectedValue(new Error("network"));
    renderWith(<QuranIndexScreen />);
    await waitFor(() => expect(screen.getByText("Something went wrong.")).toBeTruthy());
  });
});

describe("QuranReaderScreen", () => {
  beforeEach(() => jest.mocked(getJson).mockReset());

  it("renders ayah text and a working play button", async () => {
    mockApi();
    renderWith(<QuranReaderScreen />);

    await waitFor(() =>
      expect(screen.getByText(/In the name of Allah/)).toBeTruthy(),
    );

    const play = screen.getByLabelText(/Play ayah|تشغيل الآية/);
    expect(play).toBeTruthy();
    fireEvent.press(play);
  });

  // Regression: tapping a reciter on the home shelf opens the reader and
  // autoplays; leaving and opening another must not leave the first voice
  // playing. The reader stops its ayah audio when it loses focus/unmounts.
  it("stops ayah audio when the reader loses focus/unmounts", async () => {
    mockApi();
    const view = renderWith(<QuranReaderScreen />);

    await waitFor(() =>
      expect(screen.getByText(/In the name of Allah/)).toBeTruthy(),
    );

    mockPlayer.pause.mockClear();
    view.unmount();
    expect(mockPlayer.pause).toHaveBeenCalled();
  });
});
