import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  buildRadioRow,
  RADIO_NAME_CACHE_KEY,
} from "@/features/radio/widget/build-radio-row";
import { getJson } from "@/lib/api";
import { getRadioFavorites, getRecentStations } from "@/lib/device-local";
import type { RadioStation } from "@repo/shared-core/schemas/radio";

jest.mock("@/lib/api", () => ({ getJson: jest.fn() }));
jest.mock("@/lib/device-local", () => ({
  getRecentStations: jest.fn(),
  getRadioFavorites: jest.fn(),
}));

const mockGetJson = jest.mocked(getJson);
const mockGetRecentStations = jest.mocked(getRecentStations);
const mockGetRadioFavorites = jest.mocked(getRadioFavorites);

function station(overrides: Partial<RadioStation> = {}): RadioStation {
  return {
    id: "507f1f77bcf86cd799439011",
    slug: "quran-radio",
    ar: { name: "إذاعة القرآن الكريم" },
    en: { name: "Quran Radio" },
    country: "EG",
    streamUrl: "https://example.com/stream.mp3",
    streamType: "mp3",
    language: "ar",
    category: "quran",
    isLive: true,
    isFeatured: true,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const STATIONS: RadioStation[] = [
  station({ id: "1".padStart(24, "0"), slug: "quran-radio", ar: { name: "إذاعة القرآن" }, en: { name: "Quran Radio" } }),
  station({ id: "2".padStart(24, "0"), slug: "sunnah-radio", ar: { name: "إذاعة السنة" }, en: { name: "Sunnah Radio" } }),
  station({ id: "3".padStart(24, "0"), slug: "seerah-radio", ar: { name: "إذاعة السيرة" }, en: { name: "Seerah Radio" } }),
  station({ id: "4".padStart(24, "0"), slug: "nasheed-radio", ar: { name: "إذاعة الأناشيد" }, en: { name: "Nasheed Radio" } }),
];

describe("buildRadioRow", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockGetRecentStations.mockResolvedValue([]);
    mockGetRadioFavorites.mockResolvedValue([]);
  });

  it("no station ever played -> generic label, empty stations, no fetch", async () => {
    const result = await buildRadioRow("en");
    expect(result).toEqual({ label: "Radio", stations: [] });
    expect(mockGetJson).not.toHaveBeenCalled();
  });

  it("recent-then-favorite merge, deduped, capped at 3, recent first", async () => {
    mockGetRecentStations.mockResolvedValue(["quran-radio", "sunnah-radio"]);
    mockGetRadioFavorites.mockResolvedValue(["sunnah-radio", "seerah-radio", "nasheed-radio"]);
    mockGetJson.mockResolvedValue(STATIONS);

    const result = await buildRadioRow("en");
    // Dedupe keeps "sunnah-radio" at its first (recent) position; capped to 3.
    expect(result).toEqual({ label: "Radio", stations: ["Quran Radio", "Sunnah Radio", "Seerah Radio"] });
    expect(mockGetJson).toHaveBeenCalledWith("/radio");
    await expect(AsyncStorage.getItem(RADIO_NAME_CACHE_KEY)).resolves.toBe(
      JSON.stringify(["Quran Radio", "Sunnah Radio", "Seerah Radio"]),
    );
  });

  it("recent only, fewer than 3 -> that many names, locale-resolved", async () => {
    mockGetRecentStations.mockResolvedValue(["quran-radio"]);
    mockGetJson.mockResolvedValue(STATIONS);

    const result = await buildRadioRow("ar");
    expect(result).toEqual({ label: "إذاعة", stations: ["إذاعة القرآن"] });
  });

  it("favorites only (no recent) -> resolves from favorites", async () => {
    mockGetRadioFavorites.mockResolvedValue(["seerah-radio"]);
    mockGetJson.mockResolvedValue(STATIONS);

    const result = await buildRadioRow("en");
    expect(result).toEqual({ label: "Radio", stations: ["Seerah Radio"] });
  });

  it("network failure with a prior cached list -> falls back to the cache", async () => {
    mockGetRecentStations.mockResolvedValue(["quran-radio"]);
    await AsyncStorage.setItem(RADIO_NAME_CACHE_KEY, JSON.stringify(["Quran Radio", "Sunnah Radio"]));
    mockGetJson.mockRejectedValue(new Error("network down"));

    const result = await buildRadioRow("en");
    expect(result).toEqual({ label: "Radio", stations: ["Quran Radio", "Sunnah Radio"] });
  });

  it("network failure with no cache -> empty stations, generic label", async () => {
    mockGetRecentStations.mockResolvedValue(["quran-radio"]);
    mockGetJson.mockRejectedValue(new Error("network down"));

    const result = await buildRadioRow("en");
    expect(result).toEqual({ label: "Radio", stations: [] });
  });

  it("slugs not found in the station list -> empty stations, never throws", async () => {
    mockGetRecentStations.mockResolvedValue(["missing-slug"]);
    mockGetJson.mockResolvedValue(STATIONS); // list doesn't contain "missing-slug"

    const result = await buildRadioRow("en");
    expect(result).toEqual({ label: "Radio", stations: [] });
  });

  it("never throws even when device-local reads themselves reject", async () => {
    mockGetRecentStations.mockRejectedValue(new Error("storage unavailable"));
    mockGetRadioFavorites.mockRejectedValue(new Error("storage unavailable"));

    await expect(buildRadioRow("en")).resolves.toEqual({ label: "Radio", stations: [] });
  });

  it("never throws when the AsyncStorage cache read itself rejects", async () => {
    mockGetRecentStations.mockResolvedValue(["quran-radio"]);
    mockGetJson.mockRejectedValue(new Error("network down"));
    jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(buildRadioRow("en")).resolves.toEqual({ label: "Radio", stations: [] });
  });
});
