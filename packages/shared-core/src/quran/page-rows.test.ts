import { describe, expect, it } from "vitest";

import { buildPageRows, type PageRowsSegment } from "./page-rows";

// Minimal word factory: position/line/page are what the builder actually reads.
function w(position: number, line: number, page = 293, arabic = `w${position}`) {
  return { position, arabic, line, page };
}

// Page 293 of the Madani mushaf — the owner's reference screenshot. Al-Israa
// ends on it and Al-Kahf begins; Al-Kahf 18:1 really is on line 12 (verified
// against quran.com).
const israa: PageRowsSegment = {
  surahNumber: 17,
  showBismillah: false,
  surahAyahCount: 111,
  ayahs: [
    { numberGlobal: 2140, ayahInSurah: 110, words: [w(1, 8), w(2, 8), w(3, 9)] },
    { numberGlobal: 2141, ayahInSurah: 111, words: [w(1, 9), w(2, 9)] },
  ],
};

const kahf: PageRowsSegment = {
  surahNumber: 18,
  showBismillah: true,
  surahAyahCount: 110,
  ayahs: [
    { numberGlobal: 2142, ayahInSurah: 1, words: [w(1, 12), w(2, 12), w(3, 13)] },
    { numberGlobal: 2143, ayahInSurah: 2, words: [w(1, 13)] },
  ],
};

describe("buildPageRows", () => {
  it("interleaves banner and Bismillah before the surah that starts mid-page", () => {
    const rows = buildPageRows({ page: 293, segments: [israa, kahf] });

    expect(rows?.map((r) => r.kind)).toEqual([
      "line", // Al-Israa line 8
      "line", // Al-Israa line 9
      "surah-banner", // Al-Kahf opens
      "bismillah",
      "line", // Al-Kahf line 12
      "line", // Al-Kahf line 13
    ]);
  });

  it("does NOT emit a banner for a surah that merely continues onto this page", () => {
    const rows = buildPageRows({ page: 293, segments: [israa] });
    expect(rows?.some((r) => r.kind === "surah-banner")).toBe(false);
  });

  it("groups words onto their printed line, in position order", () => {
    const rows = buildPageRows({ page: 293, segments: [israa] });
    const line8 = rows?.find((r) => r.kind === "line" && r.lineNumber === 8);

    expect(line8?.kind === "line" && line8.words.map((x) => x.arabic)).toEqual(["w1", "w2"]);
  });

  it("marks only an ayah's final word as carrying the end marker", () => {
    const rows = buildPageRows({ page: 293, segments: [israa] });
    const line9 = rows?.find((r) => r.kind === "line" && r.lineNumber === 9);
    // line 9 = ayah 110's w3 (its last) + ayah 111's w1, w2 (w2 is its last).
    expect(line9?.kind === "line" && line9.words.map((x) => x.endsAyah)).toEqual([
      true,
      false,
      true,
    ]);
  });

  it("centres the last line only when the surah actually ENDS on this page", () => {
    const rows = buildPageRows({ page: 293, segments: [israa, kahf] });
    const lines = rows?.filter((r) => r.kind === "line") ?? [];

    // Al-Israa's ayah 111 is its last → its final line ends the surah.
    expect(lines[1]?.kind === "line" && lines[1].endsSurah).toBe(true);
    // Al-Kahf runs on to page 294 → its last line here is NOT a surah end.
    expect(lines[3]?.kind === "line" && lines[3].endsSurah).toBe(false);
  });

  it("justifies (never centres) when ayahCount is unknown", () => {
    const noCount = { ...israa, surahAyahCount: undefined };
    const rows = buildPageRows({ page: 293, segments: [noCount] });
    expect(rows?.every((r) => r.kind !== "line" || !r.endsSurah)).toBe(true);
  });

  it("ignores words belonging to a different page, so a straddling ayah splits", () => {
    const straddling: PageRowsSegment = {
      surahNumber: 17,
      showBismillah: false,
      ayahs: [
        {
          numberGlobal: 2141,
          ayahInSurah: 111,
          words: [w(1, 15, 292), w(2, 1, 293)],
        },
      ],
    };
    const rows = buildPageRows({ page: 293, segments: [straddling] });
    const lines = rows?.filter((r) => r.kind === "line") ?? [];

    expect(lines).toHaveLength(1);
    expect(lines[0]?.kind === "line" && lines[0].words.map((x) => x.arabic)).toEqual(["w2"]);
  });

  it("returns null when layout data is absent, so the caller reflows", () => {
    const unseeded: PageRowsSegment = {
      surahNumber: 17,
      showBismillah: false,
      ayahs: [{ numberGlobal: 2141, ayahInSurah: 111, words: [{ position: 1, arabic: "w1" }] }],
    };
    expect(buildPageRows({ page: 293, segments: [unseeded] })).toBeNull();
  });

  it("returns null when only SOME segments have layout — never half-laid-out", () => {
    const unseeded: PageRowsSegment = {
      surahNumber: 18,
      showBismillah: true,
      ayahs: [{ numberGlobal: 2142, ayahInSurah: 1, words: [{ position: 1, arabic: "x" }] }],
    };
    expect(buildPageRows({ page: 293, segments: [israa, unseeded] })).toBeNull();
  });

  it("handles a page of several complete short surahs (juz 30)", () => {
    const short = (n: number, line: number): PageRowsSegment => ({
      surahNumber: n,
      showBismillah: true,
      surahAyahCount: 1,
      ayahs: [{ numberGlobal: n, ayahInSurah: 1, words: [w(1, line, 604)] }],
    });
    const rows = buildPageRows({ page: 604, segments: [short(112, 2), short(113, 5)] });

    expect(rows?.map((r) => r.kind)).toEqual([
      "surah-banner",
      "bismillah",
      "line",
      "surah-banner",
      "bismillah",
      "line",
    ]);
  });
});
