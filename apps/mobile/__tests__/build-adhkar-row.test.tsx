import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  ADHKAR_SLUGS_CACHE_KEY,
  buildAdhkarRow,
} from "@/features/adhkar/widget/build-adhkar-row";
import { getJson } from "@/lib/api";
import type { Azkar } from "@repo/shared-core/schemas/azkar";

jest.mock("@/lib/api", () => ({ getJson: jest.fn() }));

const mockGetJson = jest.mocked(getJson);

// Seeded order: [morning, evening, sleep, wake, prayer, mosque] — the first
// ADHKAR_PREVIEW_COUNT (5) are tagged 🌅🌙😴⏰🤲. Unlike the in-app Home
// shelf, the widget shows all 5 (no excludeWake) — owner request.
function set(id: string, kind: Azkar["kind"], arSlug: string, enSlug: string): Azkar {
  return {
    id,
    kind,
    status: "published",
    order: 0,
    ar: { title: arSlug, slug: arSlug },
    en: { title: enSlug, slug: enSlug },
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const SETS: Azkar[] = [
  set("1".padStart(24, "0"), "morning", "اذكار-الصباح", "morning-adhkar"),
  set("2".padStart(24, "0"), "evening", "اذكار-المساء", "evening-adhkar"),
  set("3".padStart(24, "0"), "other", "اذكار-النوم", "sleep-adhkar"),
  set("4".padStart(24, "0"), "other", "اذكار-الاستيقاظ", "waking-adhkar"),
  set("5".padStart(24, "0"), "other", "دعاء-الصلاة", "prayer-adhkar"),
];

describe("buildAdhkarRow", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("fetch resolves -> 5 items (wake included) with per-set deep-link URIs", async () => {
    mockGetJson.mockResolvedValue(SETS);

    const result = await buildAdhkarRow("en");
    expect(result.title).toBe("Adhkar");
    expect(result.items).toEqual([
      { icon: "🌅", uri: "nour:///adhkar/morning-adhkar" },
      { icon: "🌙", uri: "nour:///adhkar/evening-adhkar" },
      { icon: "😴", uri: "nour:///adhkar/sleep-adhkar" },
      { icon: "⏰", uri: "nour:///adhkar/waking-adhkar" },
      { icon: "🤲", uri: "nour:///adhkar/prayer-adhkar" },
    ]);
    expect(mockGetJson).toHaveBeenCalledWith("/adhkar");
  });

  it("fetch resolves -> ar locale uses ar slugs, caches the resolved items", async () => {
    mockGetJson.mockResolvedValue(SETS);

    const result = await buildAdhkarRow("ar");
    expect(result.title).toBe("الأذكار");
    expect(result.items[0]).toEqual({ icon: "🌅", uri: `nour:///adhkar/${encodeURIComponent("اذكار-الصباح")}` });

    const cached = await AsyncStorage.getItem(ADHKAR_SLUGS_CACHE_KEY);
    expect(JSON.parse(cached!)).toEqual(result.items);
  });

  it("fetch fails with a prior cache -> falls back to the cached URIs", async () => {
    const cachedItems = [
      { icon: "🌅", uri: "nour:///adhkar/morning-adhkar" },
      { icon: "🌙", uri: "nour:///adhkar/evening-adhkar" },
    ];
    await AsyncStorage.setItem(ADHKAR_SLUGS_CACHE_KEY, JSON.stringify(cachedItems));
    mockGetJson.mockRejectedValue(new Error("network down"));

    const result = await buildAdhkarRow("en");
    expect(result).toEqual({ title: "Adhkar", items: cachedItems });
  });

  it("fetch fails with no cache -> 5 static icons pointing at the plain list", async () => {
    mockGetJson.mockRejectedValue(new Error("network down"));

    const result = await buildAdhkarRow("en");
    expect(result.items).toEqual([
      { icon: "🌅", uri: "nour:///adhkar" },
      { icon: "🌙", uri: "nour:///adhkar" },
      { icon: "😴", uri: "nour:///adhkar" },
      { icon: "⏰", uri: "nour:///adhkar" },
      { icon: "🤲", uri: "nour:///adhkar" },
    ]);
  });

  it("never throws when the cache read itself is corrupt", async () => {
    mockGetJson.mockRejectedValue(new Error("network down"));
    await AsyncStorage.setItem(ADHKAR_SLUGS_CACHE_KEY, "not-json");

    await expect(buildAdhkarRow("en")).resolves.toEqual({
      title: "Adhkar",
      items: [
        { icon: "🌅", uri: "nour:///adhkar" },
        { icon: "🌙", uri: "nour:///adhkar" },
        { icon: "😴", uri: "nour:///adhkar" },
        { icon: "⏰", uri: "nour:///adhkar" },
        { icon: "🤲", uri: "nour:///adhkar" },
      ],
    });
  });

  it("never throws when the AsyncStorage cache write itself rejects", async () => {
    mockGetJson.mockResolvedValue(SETS);
    jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("storage unavailable"));

    const result = await buildAdhkarRow("en");
    expect(result.items).toHaveLength(5);
  });
});
