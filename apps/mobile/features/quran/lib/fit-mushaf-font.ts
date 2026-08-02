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
  /**
   * The page's REAL printed line count, from `buildPageRows` (one row per
   * kind:"line"). A printed mushaf page's line count is fixed by the source
   * layout, not by reflow — so when this is known it's strictly better than
   * the `glyphCount / charsPerLine` estimate below, which assumes the text
   * reflows to the measured width (true only for the fallback path, where no
   * per-word line data exists). Omit for that fallback path.
   */
  lineCount?: number;
}

// Mean horizontal advance of an Uthmani glyph, in em. Calibrated against the
// A72 render — if the bundled Quran font is ever swapped, this is the ONE
// constant to re-tune (raise it if text overflows, lower it if a void returns).
const GLYPH_ADVANCE_EM = 0.42;

// Matches ayah-row.tsx and web's `leading-[2.2]`. Uthmani needs the room: the
// diacritic stack above/below the baseline collides at anything tighter.
const LINE_HEIGHT_RATIO = 2.2;

// Segment banner + Bismillah sizes, expressed as multiples of the ayah size so
// the whole block scales together. Exported because MushafSegment renders with
// them and this module models their height — one source of truth, or the fit
// silently drifts from what's on screen.
export const BANNER_NAME_RATIO = 1.3;
export const BISMILLAH_RATIO = 1.1;
// Single-line Uthmani needs a line box well above its font size or the tall
// diacritics overflow onto the next element (device-confirmed: the surah name
// was colliding with the EN subtitle under it). Owner-reported 2026-08-01: the
// Bismillah itself was clipped top/bottom on device — 1.6 gave it a line box
// 27% TIGHTER than ordinary printed lines get from LINE_HEIGHT_RATIO (2.2) in
// the SAME font, so Android clipped whatever exceeded the box. Matched to 2.2:
// a single line of Uthmani needs the same headroom whether it's a printed ayah
// or the banner/Bismillah, since it's the same glyphs' diacritic stack.
export const DIACRITIC_LINE_RATIO = 2.2;

// Floor keeps a dense page legible even if that means it scrolls; ceiling stops
// a 3-ayah page (juz 30) from rendering absurd poster-sized text.
const MIN_FONT = 17;
const MAX_FONT = 40;

// Non-font-scaled chrome inside the scroll area, in dp: per-segment padding +
// borders (`pb-6 pt-4` on the segment container), the EN subtitle line under
// each banner, and the page footer row. The per-ROW gap is modelled separately
// below — it scales with row count, so it can't live in a per-segment constant.
const SEGMENT_FIXED_CHROME = 62;
const FOOTER_CHROME = 52;

// Separation below the surah banner and below the Bismillah, in dp (`mb-4` on
// each in mushaf-page.tsx). Printed LINES deliberately carry no such gap:
// LINE_HEIGHT_RATIO owns row spacing, exactly as it does inside a wrapped
// paragraph, so a printed page has uniform leading.
//
// This used to be `gap-4` on the segment container, which — because MushafRows
// returns a fragment — put 16dp between every pair of printed lines as well.
// The model never counted it, so it undercounted a 15-line page by ~240dp on a
// ~560dp viewport and the search picked a size that overflowed by ~40%. Merely
// modelling that gap doesn't rescue it: 240dp of leading on top of 15 line
// boxes cannot fit at any size ≥ MIN_FONT, so every dense page floor-clamped
// and overflowed regardless. The gap between lines had to go, not just be
// counted. Renderer and model must agree — same class of drift as the
// BANNER/BISMILLAH/DIACRITIC ratios above.
const BLOCK_GAP = 16;

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
  const { glyphCount, segmentCount, bismillahCount, width, lineCount } = input;
  let lines: number;
  if (lineCount !== undefined) {
    // Real print layout: the line count doesn't change with font size or
    // measured width, unlike the reflow estimate below.
    lines = lineCount;
  } else {
    const charsPerLine = Math.max(1, width / (font * GLYPH_ADVANCE_EM));
    lines = Math.ceil(glyphCount / charsPerLine);
  }
  const paragraph = lines * font * LINE_HEIGHT_RATIO;
  // Both are single lines, but each occupies a DIACRITIC_LINE_RATIO-tall line
  // box — model the box, not the font size, or the fit overshoots the viewport.
  const banners =
    segmentCount * (font * BANNER_NAME_RATIO * DIACRITIC_LINE_RATIO + SEGMENT_FIXED_CHROME);
  const bismillahs = bismillahCount * font * BISMILLAH_RATIO * DIACRITIC_LINE_RATIO;
  // One block gap under each banner and each Bismillah. Independent of line
  // count and identical on both render paths, since only those two elements
  // carry `mb-4` — printed lines are spaced by their line box alone.
  const blockGaps = (segmentCount + bismillahCount) * BLOCK_GAP;
  return paragraph + banners + bismillahs + blockGaps + FOOTER_CHROME;
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
