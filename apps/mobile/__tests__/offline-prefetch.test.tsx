import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";

import { runOfflinePrefetch } from "@/lib/offline-prefetch";
import { getJson } from "@/lib/api";
import { quranSurahReaderQuery } from "@/lib/queries";
import { DEFAULT_QURAN_PREFS } from "@/lib/device-local";
import { readSurah, writeSurah } from "@/lib/quran-offline-store";

jest.mock("@/lib/api", () => ({ getJson: jest.fn() }));

const MARKER_KEY = "nour.quran.offline.v1";
const APP_VERSION = "1.1.0";

const azkarSet = {
  id: "set1",
  kind: "morning",
  status: "published",
  order: 0,
  ar: { title: "أذكار الصباح", slug: "morning-ar" },
  en: { title: "Morning Adhkar", slug: "morning" },
  items: [{ ar: "سبحان الله", en: "Glory be to Allah", repeat: 3 }],
  createdAt: "",
  updatedAt: "",
};

const surahs = [
  {
    number: 1,
    name: { ar: "الفاتحة", en: "Al-Fatihah" },
    meaning: "The Opening",
    revelationPlace: "meccan",
    ayahCount: 7,
    pageStart: 1,
    pageEnd: 1,
    bismillahPre: true,
  },
  {
    number: 2,
    name: { ar: "البقرة", en: "Al-Baqarah" },
    meaning: "The Cow",
    revelationPlace: "medinan",
    ayahCount: 286,
    pageStart: 2,
    pageEnd: 49,
    bismillahPre: true,
  },
];

function surahPayload(n: number) {
  return { ayahs: [], surahNumber: n };
}

function mockApi(handler: (path: string) => Promise<unknown>) {
  (jest.mocked(getJson) as jest.Mock).mockImplementation(handler);
}

function makeClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function currentMarker(overrides: Partial<Record<string, string>> = {}) {
  return {
    locale: "en",
    translation: DEFAULT_QURAN_PREFS.translationSlug,
    reciter: DEFAULT_QURAN_PREFS.reciterSlug,
    version: APP_VERSION,
    ...overrides,
  };
}

describe("runOfflinePrefetch", () => {
  beforeEach(async () => {
    jest.mocked(getJson).mockReset();
    await AsyncStorage.clear();
  });

  it("marks the run complete after a fully successful pass", async () => {
    mockApi((path) => {
      if (path === "/adhkar") return Promise.resolve([azkarSet]);
      if (path.startsWith("/adhkar/")) return Promise.resolve(azkarSet);
      if (path === "/quran/surahs") return Promise.resolve(surahs);
      if (path === "/quran/surah/1") return Promise.resolve(surahPayload(1));
      if (path === "/quran/surah/2") return Promise.resolve(surahPayload(2));
      return Promise.reject(new Error(`unexpected path ${path}`));
    });

    await runOfflinePrefetch(makeClient(), "en", APP_VERSION);

    const raw = await AsyncStorage.getItem(MARKER_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual(currentMarker());
    // Every adhkar item + every surah was fetched.
    expect(getJson).toHaveBeenCalledWith("/adhkar/morning", expect.anything());
    expect(getJson).toHaveBeenCalledWith("/quran/surah/1", expect.anything());
    expect(getJson).toHaveBeenCalledWith("/quran/surah/2", expect.anything());
  });

  it("writes each surah payload to the offline file store on a successful prefetch", async () => {
    mockApi((path) => {
      if (path === "/adhkar") return Promise.resolve([]);
      if (path === "/quran/surahs") return Promise.resolve(surahs);
      if (path === "/quran/surah/1") return Promise.resolve(surahPayload(1));
      if (path === "/quran/surah/2") return Promise.resolve(surahPayload(2));
      return Promise.reject(new Error(`unexpected path ${path}`));
    });

    await runOfflinePrefetch(makeClient(), "en", APP_VERSION);

    const identity = {
      locale: "en" as const,
      translationSlug: DEFAULT_QURAN_PREFS.translationSlug,
      reciterSlug: DEFAULT_QURAN_PREFS.reciterSlug,
    };
    await expect(readSurah({ surah: 1, ...identity })).resolves.toEqual(surahPayload(1));
    await expect(readSurah({ surah: 2, ...identity })).resolves.toEqual(surahPayload(2));
  });

  it("skips the network entirely when the marker already matches current prefs and app version", async () => {
    await AsyncStorage.setItem(MARKER_KEY, JSON.stringify(currentMarker()));
    mockApi(() => Promise.reject(new Error("should not be called")));

    await runOfflinePrefetch(makeClient(), "en", APP_VERSION);

    expect(getJson).not.toHaveBeenCalled();
  });

  it("re-triggers a full prefetch when the marker's app version doesn't match the current one", async () => {
    // Locale/translation/reciter all match current prefs — only the app
    // version differs (simulates an update that wiped the persisted query
    // cache via the buster, which this marker must not silently outlive).
    await AsyncStorage.setItem(MARKER_KEY, JSON.stringify(currentMarker({ version: "1.0.0" })));
    mockApi((path) => {
      if (path === "/adhkar") return Promise.resolve([]);
      if (path === "/quran/surahs") return Promise.resolve(surahs);
      if (path === "/quran/surah/1") return Promise.resolve(surahPayload(1));
      if (path === "/quran/surah/2") return Promise.resolve(surahPayload(2));
      return Promise.reject(new Error(`unexpected path ${path}`));
    });

    await runOfflinePrefetch(makeClient(), "en", APP_VERSION);

    expect(getJson).toHaveBeenCalledWith("/quran/surahs");
    const raw = await AsyncStorage.getItem(MARKER_KEY);
    expect(JSON.parse(raw as string)).toEqual(currentMarker());
  });

  it("leaves the completion marker unset when a fetch fails mid-run", async () => {
    mockApi((path) => {
      if (path === "/adhkar") return Promise.resolve([azkarSet]);
      if (path.startsWith("/adhkar/")) return Promise.reject(new Error("network down"));
      return Promise.reject(new Error(`unexpected path ${path}`));
    });

    await runOfflinePrefetch(makeClient(), "en", APP_VERSION);

    const raw = await AsyncStorage.getItem(MARKER_KEY);
    expect(raw).toBeNull();
  });
});

describe("quranSurahReaderQuery offline fallback", () => {
  beforeEach(async () => {
    jest.mocked(getJson).mockReset();
    await AsyncStorage.clear();
  });

  it("falls back to the offline file store when the network fetch fails", async () => {
    const identity = {
      surah: 1,
      locale: "en" as const,
      translationSlug: DEFAULT_QURAN_PREFS.translationSlug,
      reciterSlug: DEFAULT_QURAN_PREFS.reciterSlug,
    };
    await writeSurah(identity, surahPayload(1) as never);
    mockApi(() => Promise.reject(new Error("network down")));

    const client = makeClient();
    const result = await client.fetchQuery(
      quranSurahReaderQuery(1, "en", DEFAULT_QURAN_PREFS.translationSlug, DEFAULT_QURAN_PREFS.reciterSlug),
    );

    expect(result).toEqual(surahPayload(1));
  });

  it("rethrows the network error when no offline file is present", async () => {
    mockApi(() => Promise.reject(new Error("network down")));
    const client = makeClient();

    await expect(
      client.fetchQuery(
        quranSurahReaderQuery(9, "en", DEFAULT_QURAN_PREFS.translationSlug, DEFAULT_QURAN_PREFS.reciterSlug),
      ),
    ).rejects.toThrow("network down");
  });
});
