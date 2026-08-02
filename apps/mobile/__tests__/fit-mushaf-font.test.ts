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
    // Banner name and Bismillah each occupy a 2.2x-tall line box — matched to
    // ordinary printed lines (owner-reported clip bug: 1.6 gave the Bismillah a
    // line box 27% tighter than the SAME font's printed lines get, so Android
    // clipped it). Reflow path: `gap-4` sits between the banner block, the
    // Bismillah and the single paragraph Text — 2 gaps for this fixture.
    return lines * font * 2.2 + (font * 1.3 * 2.2 + 62) + font * 1.1 * 2.2 + 2 * 16 + 52;
  }

  // A Madani page carries roughly 15 lines of ~30 advance glyphs, so real pages
  // land in the low hundreds; 100–400 spans sparse juz-30 pages to dense ones.
  // 400 is the top of the fitting range on this area — beyond it the search
  // reaches MIN_FONT and the page scrolls (covered by the next test). That
  // ceiling used to read as ~500 only because the model wasn't counting the
  // 32dp of block gap the renderer has always applied.
  it("fills the area without overflowing across the real page-size range", () => {
    for (const glyphs of [100, 150, 200, 300, 400]) {
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

  describe("lineCount (real printed line count from buildPageRows)", () => {
    // Laid-out height using the FIXED line count, mirroring heightAt's
    // lineCount branch — no charsPerLine/width dependency at all.
    // Rows path: printed lines are spaced by their line box alone. Only the
    // banner and the Bismillah carry `mb-4`, so the gap total is flat in the
    // line count — 2 × 16dp for this 1-segment/1-Bismillah fixture.
    function laidOutHeightFromLines(font: number, lines: number): number {
      return lines * font * 2.2 + (font * 1.3 * 2.2 + 62) + font * 1.1 * 2.2 + 2 * 16 + 52;
    }

    it("fills the area using the real line count instead of the glyph estimate", () => {
      // An 8-line page — the estimate path would derive a DIFFERENT line count
      // from glyphCount/width, so feeding lineCount must actually change the
      // result, not be ignored.
      const withLineCount = fit(300, { lineCount: 8 });
      const withoutLineCount = fit(300);
      expect(withLineCount).not.toBe(withoutLineCount);
      const height = laidOutHeightFromLines(withLineCount, 8);
      expect(height).toBeLessThanOrEqual(AREA.height + 1);
      expect(height).toBeGreaterThan(AREA.height * 0.9);
    });

    it("does not vary with width when lineCount is provided (real layout, not reflow)", () => {
      expect(fit(300, { lineCount: 8, width: 200 })).toBe(fit(300, { lineCount: 8, width: 600 }));
    });

    it("still clamps to floor/ceiling with a real line count", () => {
      expect(fit(300, { lineCount: 100 })).toBe(17);
      expect(fit(300, { lineCount: 1 })).toBeLessThanOrEqual(40);
    });

    // Closed-form check of the layout model, derived independently of the
    // helper above so it can't drift along with it. An unclamped fit lands
    // exactly on the viewport, so:
    //   H = f·(lines·2.2 + BANNER·DIACRITIC + BISMILLAH·DIACRITIC) + SEG + GAPS + FOOT
    // The gap term is the constant 2×16 — one under the banner, one under the
    // Bismillah. If a per-LINE gap ever creeps back in (the `gap-4`-on-a-
    // fragment bug), `lines` would pick up a ×16 coefficient and this breaks.
    it("charges gap per block, not per printed line", () => {
      for (const lines of [5, 8]) {
        const expected = (AREA.height - 62 - 2 * 16 - 52) / (lines * 2.2 + 1.3 * 2.2 + 1.1 * 2.2);
        expect(fit(450, { lineCount: lines })).toBeCloseTo(expected, 4);
      }
    });

    // A real 15-line Madani page does NOT fit an A72 reading area: 15 line
    // boxes at the MIN_FONT floor is 15×17×2.2 = 561dp, i.e. the whole 560dp
    // viewport before any banner, Bismillah or footer. It therefore scrolls,
    // by the same deliberate trade as the dense-page case above.
    //
    // What the row-gap removal bought is the size of that overflow: the
    // container's old `gap-4` added 16dp between every printed line — 240dp on
    // this page — so the same page laid out ~996dp against a 560dp viewport
    // (~78% over). It is now ~772dp (~38% over), and the model finally agrees
    // with the renderer instead of undercounting by the whole gap stack.
    it("still floor-clamps a full 15-line page, but without the per-line gap stack", () => {
      const font = fit(450, { lineCount: 15 });
      expect(font).toBe(17);
      const height = laidOutHeightFromLines(font, 15);
      expect(height).toBeGreaterThan(AREA.height); // scrolls — accepted
      expect(height).toBeLessThan(800); // was ~996 with a gap under every line
    });
  });
});
