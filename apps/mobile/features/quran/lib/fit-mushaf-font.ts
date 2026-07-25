// Sizes the Mushaf page's Uthmani text to FILL the measured reading area.
//
// Why this exists: a fixed font size can't satisfy "no empty space" across the
// mushaf. Madani pages hold roughly-constant text volume, but "roughly" spans
// ~2x (juz 30's short surahs vs a dense Al-Baqarah page), so any single size
// either leaves a void on light pages or overflows the dense ones. The owner's
// bar is "the ayahs fill the page" — that's a solve-for-f problem, not a
// magic-number problem, and it's the reason four prior rounds of pure layout
// tweaks (see memory/project_mushaf_full_page_layout.md) never closed it: they
// moved the footer around instead of growing the content to meet it.
//
// Pure + platform-free so it unit-tests without a renderer.

export interface FitMushafFontInput {
  /** Advance-bearing glyph count for the page (see countAdvanceGlyphs). */
  glyphCount: number;
  /** Number of surah-runs on the page — each carries a name banner. */
  segmentCount: number;
  /** How many of those segments render a Bismillah. */
  bismillahCount: number;
  /** Measured reading-area width in dp (already net of horizontal padding). */
  width: number;
  /** Measured reading-area height in dp (already net of the dock reservation). */
  height: number;
  /** User's font-size preference from reader settings; 1 = auto-fit exactly. */
  fontScale: number;
}

// Mean horizontal advance of an Uthmani glyph, in em. Calibrated against the
// A72 render — if the bundled Quran font is ever swapped, this is the ONE
// constant to re-tune (raise it if text overflows, lower it if a void returns).
const GLYPH_ADVANCE_EM = 0.42;

// Matches ayah-row.tsx and web's `leading-[2.2]`. Uthmani needs the room: the
// diacritic stack above/below the baseline collides at anything tighter.
const LINE_HEIGHT_RATIO = 2.2;

// Floor keeps a dense page legible even if that means it scrolls; ceiling stops
// a 3-ayah page (juz 30) from rendering absurd poster-sized text.
const MIN_FONT = 17;
const MAX_FONT = 40;

// Non-font-scaled chrome inside the scroll area, in dp: per-segment padding +
// borders + gaps (`gap-4 pb-6 pt-4` on the segment container), the EN subtitle
// line under each banner, and the page footer row.
const SEGMENT_FIXED_CHROME = 62;
const FOOTER_CHROME = 52;

// Combining marks (fathatan…sukun, superscript alef, and the Quranic annotation
// range) stack on the base letter and consume no horizontal space, so counting
// raw `.length` on Uthmani text overstates width by ~40% and varies by how
// heavily a given ayah is marked. Count only advance-bearing glyphs.
const COMBINING_MARKS = /[ً-ٰٟۖ-ۭ]/g;

export function countAdvanceGlyphs(text: string): number {
  return text.replace(COMBINING_MARKS, "").length;
}

// Total laid-out height at a candidate font size. Monotonically increasing in
// `font`, which is what lets the caller binary-search it.
function heightAt(font: number, input: FitMushafFontInput): number {
  const { glyphCount, segmentCount, bismillahCount, width } = input;
  const charsPerLine = Math.max(1, width / (font * GLYPH_ADVANCE_EM));
  const lines = Math.ceil(glyphCount / charsPerLine);
  const paragraph = lines * font * LINE_HEIGHT_RATIO;
  // Banner name renders ~1.3x the body size; Bismillah ~1.1x (both single-line).
  const banners = segmentCount * (font * 1.3 + SEGMENT_FIXED_CHROME);
  const bismillahs = bismillahCount * font * 1.1;
  return paragraph + banners + bismillahs + FOOTER_CHROME;
}

/**
 * Largest font size whose laid-out page still fits `height`, then scaled by the
 * user's preference. Returns MIN_FONT until the container has been measured
 * (width/height 0), so the first frame renders something sane rather than
 * nothing.
 */
export function fitMushafFontSize(input: FitMushafFontInput): number {
  const { width, height, fontScale, glyphCount } = input;
  if (width <= 0 || height <= 0 || glyphCount <= 0) return MIN_FONT * fontScale;

  // Binary search the monotonic fit. 24 halvings of a 23dp range converges far
  // past sub-pixel, and costs nothing next to one layout pass.
  let low = MIN_FONT;
  let high = MAX_FONT;
  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) / 2;
    if (heightAt(mid, input) <= height) {
      low = mid;
    } else {
      high = mid;
    }
  }

  // fontScale is a deliberate user override, so it may exceed the fit (the page
  // then scrolls) — but never below the legibility floor.
  return Math.max(MIN_FONT, low * fontScale);
}
