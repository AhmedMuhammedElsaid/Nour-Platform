import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";

import QuranIndexScreen from "@/app/quran/index";
import QuranReaderScreen from "@/app/quran/[surah]";
import { getJson } from "@/lib/api";
import { DEFAULT_QURAN_PREFS } from "@/lib/device-local";
import { PlayerProvider } from "@/lib/player-context";

jest.mock("@/lib/api", () => ({
  getJson: jest.fn(),
  assetUrl: (p: string) => `https://cdn.test${p}`,
}));

// Controllable player stub so we can assert the Reader drives the RNTP player.
const mockLoadQueue = jest.fn();
const mockToggle = jest.fn();
let mockCurrentTrack: { id: string } | null = null;
// The reader reads transport + actions separately (see lib/player-context's
// four-context split); usePlayer is kept here for any consumer still using it.
jest.mock("@/lib/player-context", () => {
  const transport = () => ({
    isPlaying: false,
    isBuffering: false,
    errorMessage: null,
    hasQueue: false,
    currentIndex: -1,
    currentTrack: mockCurrentTrack,
  });
  const actions = () => ({
    loadQueue: mockLoadQueue,
    toggle: mockToggle,
    pause: jest.fn(),
    play: jest.fn(),
  });
  return {
    usePlayerTransport: transport,
    usePlayerActions: actions,
    usePlayerQueue: () => ({ queue: [], repeatMode: "off", isShuffled: false }),
    usePlayerPrefs: () => ({
      playbackRate: 1,
      volume: 1,
      sleepTimerEndsAt: null,
      sleepAtTrackEnd: false,
    }),
    usePlayer: () => ({ ...transport(), ...actions() }),
    usePlayerProgress: () => ({ currentTime: 0, duration: 0 }),
    usePlayerHasQueue: () => false,
    PlayerProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

const mockReplace = jest.fn();
jest.mock("expo-router", () => {
  const react = jest.requireActual("react") as typeof import("react");
  return {
    useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: (...args: unknown[]) => mockReplace(...args) }),
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
      textUthmani: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
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

function mockApi() {
  (jest.mocked(getJson) as jest.Mock).mockImplementation((path: string) => {
    if (path === "/quran/surahs") return Promise.resolve([surah]);
    if (path.startsWith("/quran/surah/")) return Promise.resolve(reader);
    if (path.startsWith("/quran/page/")) return Promise.resolve(pageReader);
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
    mockReplace.mockClear();
    mockCurrentTrack = null;
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

  it("Mushaf mode: shows the current juz as a top-bar chip", async () => {
    mockApi();
    renderWith(<QuranReaderScreen />);
    await waitFor(() => expect(screen.getByTestId("mushaf-ayah-1")).toBeTruthy());
    expect(screen.getByText("Juz 1")).toBeTruthy();
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

  it("List mode: surah 1 disables Previous surah, Next surah replaces the route", async () => {
    await AsyncStorage.setItem(
      "nour.quran.prefs",
      JSON.stringify({ ...DEFAULT_QURAN_PREFS, layout: "list" }),
    );
    mockApi();
    renderWith(<QuranReaderScreen />);
    await waitFor(() => expect(screen.getByText(/In the name of Allah/)).toBeTruthy());

    // Fixture surah is #1 — the first surah, so Previous is disabled.
    expect(screen.getByLabelText("Previous surah").props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText("Next surah").props.accessibilityState.disabled).toBe(false);

    fireEvent.press(screen.getByLabelText("Next surah"));
    expect(mockReplace).toHaveBeenCalledWith("/quran/2");
  });

  it("List mode: shows the current juz as a top-bar chip and a surah-position footer", async () => {
    await AsyncStorage.setItem(
      "nour.quran.prefs",
      JSON.stringify({ ...DEFAULT_QURAN_PREFS, layout: "list" }),
    );
    mockApi();
    renderWith(<QuranReaderScreen />);
    await waitFor(() => expect(screen.getByText(/In the name of Allah/)).toBeTruthy());
    expect(screen.getByText("Juz 1")).toBeTruthy();
    expect(screen.getByText("Surah 1 of 114")).toBeTruthy();
  });

  it("shows skeleton placeholders while the reader data is loading", () => {
    (jest.mocked(getJson) as jest.Mock).mockReturnValue(new Promise(() => {}));
    renderWith(<QuranReaderScreen />);
    expect(screen.UNSAFE_getAllByProps({ accessibilityRole: "progressbar" }).length).toBeGreaterThan(0);
  });
});
