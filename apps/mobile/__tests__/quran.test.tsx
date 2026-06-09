import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";

import QuranIndexScreen from "@/app/quran/index";
import QuranReaderScreen from "@/app/quran/[surah]";
import { getJson } from "@/lib/api";

jest.mock("@/lib/api", () => ({ getJson: jest.fn() }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useLocalSearchParams: () => ({ surah: "1" }),
  Stack: { Screen: () => null },
}));

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
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
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
});
