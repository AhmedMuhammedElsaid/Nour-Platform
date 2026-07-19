import {
  ayahTrackId,
  parseAyahTrackId,
  buildAyahQueue,
  buildPageQueue,
} from "@/features/quran/lib/ayah-queue";

jest.mock("@/lib/api", () => ({
  assetUrl: (p: string) => `https://cdn.test${p}`,
}));

const surah = { name: { ar: "الفاتحة", en: "Al-Fatihah" } } as never;

const ayahs = [
  { surah: 1, ayahInSurah: 1, numberGlobal: 1, audioUrl: "https://a/1.mp3" },
  { surah: 1, ayahInSurah: 2, numberGlobal: 2, audioUrl: null }, // skipped
  { surah: 1, ayahInSurah: 3, numberGlobal: 3, audioUrl: "https://a/3.mp3" },
] as never[];

const reciter = {
  slug: "alafasy",
  name: "Alafasy",
  arabicName: "مشاري العفاسي",
  image: "/reciters/alafasy.png",
  audioBase: "https://a/",
} as never;

describe("ayah-queue", () => {
  it("round-trips the track id", () => {
    expect(ayahTrackId(42)).toBe("quran:42");
    expect(parseAyahTrackId("quran:42")).toBe(42);
    expect(parseAyahTrackId("playlist:42")).toBeNull();
    expect(parseAyahTrackId(undefined)).toBeNull();
    expect(parseAyahTrackId("quran:x")).toBeNull();
  });

  it("builds one track per ayah that has audio, skipping null audio", () => {
    const q = buildAyahQueue(surah, ayahs, reciter, "en");
    expect(q).toHaveLength(2);
    expect(q[0]).toMatchObject({
      id: "quran:1",
      mediaUrl: "https://a/1.mp3",
      playlistTitle: "Alafasy",
      coverUrl: "https://cdn.test/reciters/alafasy.png",
    });
    expect(q[0]!.title).toContain("Al-Fatihah");
    expect(q[1]!.id).toBe("quran:3");
  });

  it("uses the Arabic surah name + reciter arabicName under the ar locale", () => {
    const q = buildAyahQueue(surah, ayahs, reciter, "ar");
    expect(q[0]!.title).toContain("الفاتحة");
    expect(q[0]!.playlistTitle).toBe("مشاري العفاسي");
  });

  it("tolerates a null reciter (no artist, no cover)", () => {
    const q = buildAyahQueue(surah, ayahs, null, "en");
    expect(q[0]!.playlistTitle).toBe("");
    expect(q[0]!.coverUrl).toBeUndefined();
  });
});

describe("buildPageQueue", () => {
  const naas = { name: { ar: "الناس", en: "An-Nas" } } as never;
  const nasAyahs = [
    { surah: 114, ayahInSurah: 1, numberGlobal: 6231, audioUrl: "https://a/6231.mp3" },
  ] as never[];

  it("concatenates one queue per segment, in page order, using each segment's own surah", () => {
    const segments = [
      { surah, ayahs, showBismillah: true },
      { surah: naas, ayahs: nasAyahs, showBismillah: true },
    ] as never[];
    const q = buildPageQueue(segments, reciter, "en");
    // 2 tracks from `ayahs` (one skipped for null audio) + 1 from `nasAyahs`.
    expect(q).toHaveLength(3);
    expect(q[0]!.id).toBe("quran:1");
    expect(q[1]!.id).toBe("quran:3");
    expect(q[2]!.id).toBe("quran:6231");
    expect(q[2]!.title).toContain("An-Nas");
  });

  it("returns [] for a page with no segments", () => {
    expect(buildPageQueue([], reciter, "en")).toEqual([]);
  });
});
