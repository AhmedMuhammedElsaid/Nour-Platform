import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";

import { runOfflinePrefetch } from "@/lib/offline-prefetch";
import { getJson } from "@/lib/api";
import { DEFAULT_QURAN_PREFS } from "@/lib/device-local";

jest.mock("@/lib/api", () => ({ getJson: jest.fn() }));

const MARKER_KEY = "nour.quran.offline.v1";

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

function mockApi(handler: (path: string) => Promise<unknown>) {
  (jest.mocked(getJson) as jest.Mock).mockImplementation(handler);
}

function makeClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
      if (path.startsWith("/quran/surah/")) return Promise.resolve({ ayahs: [] });
      return Promise.reject(new Error(`unexpected path ${path}`));
    });

    await runOfflinePrefetch(makeClient(), "en");

    const raw = await AsyncStorage.getItem(MARKER_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual({
      locale: "en",
      translation: DEFAULT_QURAN_PREFS.translationSlug,
      reciter: DEFAULT_QURAN_PREFS.reciterSlug,
    });
    // Every adhkar item + every surah was fetched.
    expect(getJson).toHaveBeenCalledWith("/adhkar/morning", expect.anything());
    expect(getJson).toHaveBeenCalledWith("/quran/surah/1", expect.anything());
    expect(getJson).toHaveBeenCalledWith("/quran/surah/2", expect.anything());
  });

  it("skips the network entirely when the marker already matches current prefs", async () => {
    await AsyncStorage.setItem(
      MARKER_KEY,
      JSON.stringify({
        locale: "en",
        translation: DEFAULT_QURAN_PREFS.translationSlug,
        reciter: DEFAULT_QURAN_PREFS.reciterSlug,
      }),
    );
    mockApi(() => Promise.reject(new Error("should not be called")));

    await runOfflinePrefetch(makeClient(), "en");

    expect(getJson).not.toHaveBeenCalled();
  });

  it("leaves the completion marker unset when a fetch fails mid-run", async () => {
    mockApi((path) => {
      if (path === "/adhkar") return Promise.resolve([azkarSet]);
      if (path.startsWith("/adhkar/")) return Promise.reject(new Error("network down"));
      return Promise.reject(new Error(`unexpected path ${path}`));
    });

    await runOfflinePrefetch(makeClient(), "en");

    const raw = await AsyncStorage.getItem(MARKER_KEY);
    expect(raw).toBeNull();
  });
});
