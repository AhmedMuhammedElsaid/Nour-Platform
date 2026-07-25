import { countAdvanceGlyphs, fitMushafFontSize } from "@/features/quran/lib/fit-mushaf-font";

// A72-ish reading area (411dp wide minus the FlatList's px-4, minus the dock).
const AREA = { width: 379, height: 560 };

function fit(glyphCount: number, over: Partial<Parameters<typeof fitMushafFontSize>[0]> = {}) {
  return fitMushafFontSize({
    glyphCount,
    segmentCount: 1,
    bismillahCount: 1,
    width: AREA.width,
    height: AREA.height,
    fontScale: 1,
    ...over,
  });
}

describe("countAdvanceGlyphs", () => {
  it("ignores combining diacritics, which take no horizontal space", () => {
    // Same three letters, once bare and once fully marked up.
    expect(countAdvanceGlyphs("بسم")).toBe(3);
    expect(countAdvanceGlyphs("بِسْمِ")).toBe(3);
  });

  it("counts the superscript alef and Quranic annotation marks as zero-width too", () => {
    // Alef wasla is a base letter (one advance), the superscript alef is not —
    // so the fully-marked Uthmani form is the same width as the bare spelling.
    expect(countAdvanceGlyphs("ٱلرَّحْمَٰنِ")).toBe(countAdvanceGlyphs("الرحمن"));
  });
});

describe("fitMushafFontSize", () => {
  it("gives a sparse page bigger type than a dense one", () => {
    expect(fit(200)).toBeGreaterThan(fit(1200));
  });

  // Laid-out height at a given size, mirroring the module's own model.
  function laidOutHeight(font: number, glyphs: number): number {
    const lines = Math.ceil(glyphs / (AREA.width / (font * 0.42)));
    return lines * font * 2.2 + (font * 1.3 + 62) + font * 1.1 + 52;
  }

  // A Madani page carries roughly 15 lines of ~30 advance glyphs, so real pages
  // land in the low hundreds; 100–500 spans sparse juz-30 pages to dense ones.
  it("fills the area without overflowing across the real page-size range", () => {
    for (const glyphs of [100, 150, 200, 300, 400, 500]) {
      const height = laidOutHeight(fit(glyphs), glyphs);
      expect(height).toBeLessThanOrEqual(AREA.height + 1);
      // "Fills" is the actual requirement — a fit that merely doesn't overflow
      // would leave the void this whole change exists to remove.
      expect(height).toBeGreaterThan(AREA.height * 0.9);
    }
  });

  it("lets an exceptionally dense page overflow (scroll) rather than go illegible", () => {
    expect(fit(1500)).toBe(17);
    expect(laidOutHeight(fit(1500), 1500)).toBeGreaterThan(AREA.height);
  });

  it("clamps to the legibility floor rather than shrinking without limit", () => {
    expect(fit(100000)).toBe(17);
  });

  it("clamps to the ceiling so a 3-ayah juz-30 page isn't poster-sized", () => {
    expect(fit(20)).toBeLessThanOrEqual(40);
  });

  it("treats fontScale as a user override that may exceed the fit", () => {
    const base = fit(300);
    expect(fit(300, { fontScale: 1.5 })).toBeCloseTo(base * 1.5, 5);
  });

  it("falls back to the floor before the container has been measured", () => {
    expect(fit(800, { width: 0, height: 0 })).toBe(17);
  });

  it("leaves room for each extra surah banner on a multi-segment page", () => {
    expect(fit(200, { segmentCount: 3, bismillahCount: 3 })).toBeLessThan(
      fit(200, { segmentCount: 1, bismillahCount: 1 }),
    );
  });
});
