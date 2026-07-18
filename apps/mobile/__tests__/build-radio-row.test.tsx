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

describe("buildRadioRow", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockGetRecentStations.mockResolvedValue([]);
    mockGetRadioFavorites.mockResolvedValue([]);
  });

  it("no station ever played -> generic label, stationName null", async () => {
    const result = await buildRadioRow("en");
    expect(result).toEqual({ label: "Radio", stationName: null });
    expect(mockGetJson).not.toHaveBeenCalled();
  });

  it("recent-station slug resolves via getJson -> correct name, writes the cache", async () => {
    mockGetRecentStations.mockResolvedValue(["quran-radio"]);
    mockGetJson.mockResolvedValue([station()]);

    const result = await buildRadioRow("ar");
    expect(result).toEqual({ label: "إذاعة", stationName: "إذاعة القرآن الكريم" });
    expect(mockGetJson).toHaveBeenCalledWith("/radio");
    await expect(AsyncStorage.getItem(RADIO_NAME_CACHE_KEY)).resolves.toBe("إذاعة القرآن الكريم");
  });

  it("no recent -> falls back to first favorite slug", async () => {
    mockGetRecentStations.mockResolvedValue([]);
    mockGetRadioFavorites.mockResolvedValue(["quran-radio"]);
    mockGetJson.mockResolvedValue([station()]);

    const result = await buildRadioRow("en");
    expect(result).toEqual({ label: "Radio", stationName: "Quran Radio" });
  });

  it("network failure with a prior cached name -> falls back to the cache", async () => {
    mockGetRecentStations.mockResolvedValue(["quran-radio"]);
    await AsyncStorage.setItem(RADIO_NAME_CACHE_KEY, "Quran Radio");
    mockGetJson.mockRejectedValue(new Error("network down"));

    const result = await buildRadioRow("en");
    expect(result).toEqual({ label: "Radio", stationName: "Quran Radio" });
  });

  it("network failure with no cache -> stationName null, generic label", async () => {
    mockGetRecentStations.mockResolvedValue(["quran-radio"]);
    mockGetJson.mockRejectedValue(new Error("network down"));

    const result = await buildRadioRow("en");
    expect(result).toEqual({ label: "Radio", stationName: null });
  });

  it("slug not found in the station list -> falls back to cache/null, never throws", async () => {
    mockGetRecentStations.mockResolvedValue(["missing-slug"]);
    mockGetJson.mockResolvedValue([station()]); // list doesn't contain "missing-slug"

    const result = await buildRadioRow("en");
    expect(result).toEqual({ label: "Radio", stationName: null });
  });

  it("never throws even when device-local reads themselves reject", async () => {
    mockGetRecentStations.mockRejectedValue(new Error("storage unavailable"));
    mockGetRadioFavorites.mockRejectedValue(new Error("storage unavailable"));

    await expect(buildRadioRow("en")).resolves.toEqual({ label: "Radio", stationName: null });
  });
});
