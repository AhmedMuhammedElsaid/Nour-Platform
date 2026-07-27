// Turns a mushaf page's ayahs into the ROWS a printed page actually shows.
//
// A printed Madani page is not a paragraph — it is a fixed stack of rows, where
// each row is either a line of Quranic text, an ornamental surah banner, or a
// Bismillah. quran.com's per-word `line_number` tells us exactly which words
// share a line, which is what lets the reader reproduce a page line-for-line
// (e.g. p.293 = Al-Israa's ending, banner, Bismillah, then Al-Kahf from line 12)
// instead of reflowing the text to whatever width the viewport happens to be.
//
// Deliberately NOT a service/API change: `ReaderAyah.words` already ships to all
// three surfaces, and `line`/`page` ride along on it as soon as the word seed has
// run. So this is a pure client-side transform with no contract to version, and a
// client holding a pre-seed cached payload simply gets `null` and reflows.
//
// Shape-agnostic on purpose: web/mobile have `segment.surah.number` while the
// extension flattens to `segment.surahNumber`, so callers map into this minimal
// structural input rather than this module knowing three DTOs.

export interface PageRowWord {
  arabic: string;
  /** Which ayah this word belongs to — drives tap-to-play and highlighting. */
  numberGlobal: number;
  ayahInSurah: number;
  /** This word closes its ayah, so the ayah-end marker follows it. */
  endsAyah: boolean;
}

export type PageRow =
  | { kind: "surah-banner"; surahNumber: number }
  | { kind: "bismillah"; surahNumber: number }
  | {
      kind: "line";
      lineNumber: number;
      surahNumber: number;
      words: PageRowWord[];
      /** Last line of this surah on this page — rendered centred, not justified. */
      endsSurah: boolean;
    };

export interface PageRowsWord {
  position: number;
  arabic: string;
  line?: number;
  page?: number;
}

export interface PageRowsAyah {
  numberGlobal: number;
  ayahInSurah: number;
  words: PageRowsWord[];
}

export interface PageRowsSegment {
  surahNumber: number;
  showBismillah: boolean;
  /**
   * The surah's total ayah count, used only to decide whether the segment's
   * last line is genuinely the END of the surah (centred, as in print) or just
   * the last line before the page turns (justified). Optional: without it we
   * justify, which is the safe default — a wrongly-centred full line looks far
   * more broken than a justified short one.
   */
  surahAyahCount?: number;
  ayahs: PageRowsAyah[];
}

export interface PageRowsInput {
  page: number;
  segments: PageRowsSegment[];
}

/**
 * Builds the page's rows, or returns `null` when the layout data isn't there.
 *
 * `null` is the "reflow this page the old way" signal and is a normal outcome,
 * not an error: the word seed may not have run, or the client may be serving a
 * cached pre-seed payload. Callers MUST handle it — treating layout as a hard
 * dependency would blank the reader on a partial seed.
 */
export function buildPageRows(input: PageRowsInput): PageRow[] | null {
  const rows: PageRow[] = [];

  for (const segment of input.segments) {
    // Group this segment's words by their printed line. A Map keeps first-seen
    // line order, but we sort explicitly below rather than trusting it.
    const byLine = new Map<number, PageRowWord[]>();

    for (const ayah of segment.ayahs) {
      const ordered = [...ayah.words].sort((a, b) => a.position - b.position);
      const lastPosition = ordered[ordered.length - 1]?.position;

      for (const word of ordered) {
        // Layout must be ALL-or-NOTHING per page. A word with no `line` at all
        // means the layout seed is incomplete (interrupted bulkWrite, or the
        // upstream omitted a field) — bail so the caller reflows the whole page
        // rather than silently dropping that word from a laid-out page. Without
        // this, a partially-seeded segment renders half its text and loses the
        // rest with no trace, which is far worse than an unstyled page.
        if (word.line === undefined || word.page === undefined) return null;
        // An ayah can straddle a page boundary, so filter on the WORD's page,
        // never the parent ayah's. A word legitimately belonging to the
        // neighbouring page is skipped here, not a bail.
        if (word.page !== input.page) continue;

        const bucket = byLine.get(word.line) ?? [];
        bucket.push({
          arabic: word.arabic,
          numberGlobal: ayah.numberGlobal,
          ayahInSurah: ayah.ayahInSurah,
          // Only the ayah's final word carries the end marker — and only if
          // that word is on this page, which the filter above guarantees.
          endsAyah: word.position === lastPosition,
        });
        byLine.set(word.line, bucket);
      }
    }

    // A segment with ayahs but no usable lines means the layout data is missing
    // or partial. Bail for the whole page rather than render half of it laid out
    // and half reflowed.
    if (byLine.size === 0) {
      if (segment.ayahs.length > 0) return null;
      continue;
    }

    // Chrome first: a surah that BEGINS on this page gets its banner, then its
    // Bismillah when it has one (At-Tawbah gets a banner and no Bismillah).
    if (segment.ayahs[0]?.ayahInSurah === 1) {
      rows.push({ kind: "surah-banner", surahNumber: segment.surahNumber });
      if (segment.showBismillah) {
        rows.push({ kind: "bismillah", surahNumber: segment.surahNumber });
      }
    }

    const lineNumbers = [...byLine.keys()].sort((a, b) => a - b);
    const lastLine = lineNumbers[lineNumbers.length - 1];

    // The surah only ENDS here if its final ayah is on this page. A surah that
    // merely runs out of page keeps its last line justified.
    const lastAyah = segment.ayahs[segment.ayahs.length - 1];
    const surahEndsOnThisPage =
      segment.surahAyahCount !== undefined &&
      lastAyah !== undefined &&
      lastAyah.ayahInSurah === segment.surahAyahCount;

    for (const lineNumber of lineNumbers) {
      rows.push({
        kind: "line",
        lineNumber,
        surahNumber: segment.surahNumber,
        words: byLine.get(lineNumber) ?? [],
        endsSurah: surahEndsOnThisPage && lineNumber === lastLine,
      });
    }
  }

  return rows.length > 0 ? rows : null;
}
