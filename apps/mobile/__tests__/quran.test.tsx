import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";

import QuranIndexScreen from "@/app/quran/index";
import QuranReaderScreen from "@/app/quran/[surah]";
import { getJson } from "@/lib/api";
import { DEFAULT_QURAN_PREFS } from "@/lib/device-local";
import { PlayerProvider } from "@/lib/player-context";
import * as fitMushafFontModule from "@/features/quran/lib/fit-mushaf-font";

jest.mock("@/lib/api", () => ({
  getJson: jest.fn(),
  assetUrl: (p: string) => `https://cdn.test${p}`,
}));

// Controllable player stub so we can assert the Reader drives the RNTP player.
const mockLoadQueue = jest.fn();
const mockToggle = jest.fn();
let mockCurrentTrack: { id: string } | null = null;
jest.mock("@/lib/player-context", () => ({
  usePlayer: () => ({
    isPlaying: false,
    hasQueue: false,
    currentTrack: mockCurrentTrack,
    loadQueue: mockLoadQueue,
    toggle: mockToggle,
    pause: jest.fn(),
    play: jest.fn(),
  }),
  usePlayerProgress: () => ({ currentTime: 0, duration: 0 }),
  PlayerProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockUseLocalSearchParams = jest.fn(() => ({ surah: "1" }));
jest.mock("expo-router", () => {
  const react = jest.requireActual("react") as typeof import("react");
  return {
    useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
    useLocalSearchParams: () => mockUseLocalSearchParams(),
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

// GET /quran/page/:n payload — one segment (this surah), mirroring `reader`'s
// ayahs/edition/reciter so the same fixtures cover both fetch modes.
const pageReader = {
  page: 1,
  juz: 1,
  prevPage: null,
  nextPage: 2,
  segments: [{ surah, showBismillah: true, ayahs: reader.ayahs }],
  translationEdition: reader.translationEdition,
  reciter: reader.reciter,
};

// A second surah sharing the SAME page — mirrors the owner's reported p.293
// (Al-Israa's tail + Al-Kahf's opening): one page, two segments, one flip
// should show ONLY one of them.
const surah2 = {
  number: 114,
  name: { ar: "الناس", en: "An-Nas" },
  meaning: "Mankind",
  revelationPlace: "meccan",
  ayahCount: 6,
  pageStart: 1,
  pageEnd: 1,
  bismillahPre: true,
};

const pageReaderTwoSegments = {
  page: 1,
  juz: 1,
  prevPage: null,
  nextPage: 2,
  segments: [
    { surah, showBismillah: true, ayahs: reader.ayahs },
    {
      surah: surah2,
      showBismillah: true,
      ayahs: [
        {
          surah: 114,
          ayahInSurah: 1,
          numberGlobal: 6231,
          juz: 30,
          page: 1,
          sajda: false,
          textUthmani: "قُلْ أَعُوذُ بِرَبِّ النَّاسِ",
          words: [],
          translation: "Say, I seek refuge in the Lord of mankind.",
          audioUrl: "https://everyayah.com/data/Alafasy_128kbps/114001.mp3",
        },
      ],
    },
  ],
  translationEdition: reader.translationEdition,
  reciter: reader.reciter,
};

function mockApi(page: typeof pageReader = pageReader) {
  (jest.mocked(getJson) as jest.Mock).mockImplementation((path: string) => {
    if (path === "/quran/surahs") return Promise.resolve([surah, surah2]);
    if (path.startsWith("/quran/surah/")) return Promise.resolve(reader);
    if (path.startsWith("/quran/page/")) return Promise.resolve(page);
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

  it("shows skeleton placeholders while the surah list is loading", () => {
    (jest.mocked(getJson) as jest.Mock).mockReturnValue(new Promise(() => {}));
    renderWith(<QuranIndexScreen />);
    expect(screen.UNSAFE_getAllByProps({ accessibilityRole: "progressbar" }).length).toBeGreaterThan(0);
  });

  it("groups surahs by juz on the Juz tab", async () => {
    mockApi();
    renderWith(<QuranIndexScreen />);
    await waitFor(() => expect(screen.getByText("Al-Fatihah")).toBeTruthy());
    fireEvent.press(screen.getByText("Juz"));
    await waitFor(() => expect(screen.getByText("Juz 1")).toBeTruthy());
    expect(screen.getByText("Al-Fatihah")).toBeTruthy();
  });
});

describe("QuranReaderScreen", () => {
  beforeEach(async () => {
    jest.mocked(getJson).mockReset();
    mockLoadQueue.mockClear();
    mockToggle.mockClear();
    mockCurrentTrack = null;
    mockUseLocalSearchParams.mockReturnValue({ surah: "1" });
    await AsyncStorage.clear();
  });

  it("defaults to Mushaf (page) mode: fetches by page and shows Prev/Next controls", async () => {
    mockApi();
    renderWith(<QuranReaderScreen />);

    await waitFor(() => expect(screen.getByTestId("mushaf-ayah-1")).toBeTruthy());
    expect(getJson).toHaveBeenCalledWith("/quran/page/1", expect.anything());
    expect(getJson).not.toHaveBeenCalledWith("/quran/surah/1", expect.anything());

    // Page 1 has no previous page — the control is disabled; next is enabled.
    expect(screen.getByLabelText("Previous page").props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText("Next page").props.accessibilityState.disabled).toBe(false);
  });

  it("List mode (explicit prefs): renders ayah text and a working play button", async () => {
    await AsyncStorage.setItem(
      "nour.quran.prefs",
      JSON.stringify({ ...DEFAULT_QURAN_PREFS, layout: "list" }),
    );
    mockApi();
    renderWith(<QuranReaderScreen />);

    await waitFor(() =>
      expect(screen.getByText(/In the name of Allah/)).toBeTruthy(),
    );

    const play = screen.getByLabelText(/Play ayah|تشغيل الآية/);
    fireEvent.press(play);
    expect(mockLoadQueue).toHaveBeenCalled();
    const [tracks, startIndex] = mockLoadQueue.mock.calls[0]!;
    expect(tracks[0].id).toBe("quran:1");
    expect(startIndex).toBe(0);
  });

  it("shows skeleton placeholders while the reader data is loading", () => {
    (jest.mocked(getJson) as jest.Mock).mockReturnValue(new Promise(() => {}));
    renderWith(<QuranReaderScreen />);
    expect(screen.UNSAFE_getAllByProps({ accessibilityRole: "progressbar" }).length).toBeGreaterThan(0);
  });

  // The owner's reported bug (p.293 = Al-Israa's tail + Al-Kahf's opening
  // rendered together): a page that straddles a surah boundary must show
  // ONLY one segment per flip, and Next must flip within the page without a
  // new fetch before advancing to the next real page.
  describe("multi-segment (surah-boundary) page", () => {
    it("shows only the entered surah's own segment, not the page's first", async () => {
      mockUseLocalSearchParams.mockReturnValue({ surah: "114" });
      mockApi(pageReaderTwoSegments);
      renderWith(<QuranReaderScreen />);

      // surah2 (An-Nas, entered surah) is segment 1 on this page — opening
      // here must land on ITS ayah, not segment 0's (Al-Fatihah).
      await waitFor(() => expect(screen.getByTestId("mushaf-ayah-6231")).toBeTruthy());
      expect(screen.queryByTestId("mushaf-ayah-1")).toBeNull();
      expect(screen.getByText("An-Nas · Mankind")).toBeTruthy();
      expect(screen.queryByText("Al-Fatihah · The Opening")).toBeNull();

      // Two segments share this page, so the part indicator must show — it's
      // rendered twice (header pill row + footer), hence getAllByText.
      expect(screen.getAllByText(/\(2 of 2\)/).length).toBeGreaterThan(0);
    });

    it("Next flips to the OTHER segment on the same page without refetching it", async () => {
      mockApi(pageReaderTwoSegments);
      renderWith(<QuranReaderScreen />);

      await waitFor(() => expect(screen.getByTestId("mushaf-ayah-1")).toBeTruthy());
      expect(screen.queryByTestId("mushaf-ayah-6231")).toBeNull();
      expect(screen.getAllByText(/\(1 of 2\)/).length).toBeGreaterThan(0);

      const pageFetchCalls = () =>
        (jest.mocked(getJson) as jest.Mock).mock.calls.filter(([path]) =>
          String(path).startsWith("/quran/page/"),
        ).length;
      const fetchesBefore = pageFetchCalls();

      fireEvent.press(screen.getByLabelText("Next page"));

      await waitFor(() => expect(screen.getByTestId("mushaf-ayah-6231")).toBeTruthy());
      expect(screen.queryByTestId("mushaf-ayah-1")).toBeNull();
      expect(screen.getAllByText(/\(2 of 2\)/).length).toBeGreaterThan(0);
      // Same page (1) — no new /quran/page/:n fetch for this flip.
      expect(pageFetchCalls()).toBe(fetchesBefore);
    });

    it("shows no part indicator on a single-segment page", async () => {
      mockApi(pageReader);
      renderWith(<QuranReaderScreen />);
      await waitFor(() => expect(screen.getByTestId("mushaf-ayah-1")).toBeTruthy());
      expect(screen.queryByText(/\(1 of/)).toBeNull();
    });

    // Regression guard for the bug this ticket exists to avoid re-introducing:
    // sizing the auto-fit for the WHOLE page (both segments' glyphs) shrinks
    // the type to fit text that isn't even on screen, reopening the "empty
    // space at the bottom" void fixed in 9254a65/c28dca3 — see
    // features/quran/components/reader.tsx's `mushafFontSize` memo.
    it("computes the auto-fit font for the ONE visible segment (segmentCount: 1), not the whole page", async () => {
      const fitSpy = jest.spyOn(fitMushafFontModule, "fitMushafFontSize");
      mockApi(pageReaderTwoSegments);
      renderWith(<QuranReaderScreen />);

      await waitFor(() => expect(screen.getByTestId("mushaf-ayah-1")).toBeTruthy());
      expect(fitSpy).toHaveBeenCalledWith(
        expect.objectContaining({ segmentCount: 1, bismillahCount: 1 }),
      );
      fitSpy.mockRestore();
    });
  });
});
