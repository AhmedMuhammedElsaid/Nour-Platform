// Mushaf page "parts": one surah per flip.
//
// A Madani page can straddle a surah boundary — p.293 ends Al-Israa and opens
// Al-Kahf — and `GET /api/v1/quran/page/:n` already returns that as 2+ per-surah
// `segments`. Rendering all of them at once put a surah's ending and another
// surah's beginning on the same flip, which the owner rejected. So the readers
// show ONE segment at a time and paginate by (page, part) instead of by page,
// keeping the standard 604-page Madani numbering intact.
//
// This module is the single source of truth for that cursor math — all three
// surfaces (web/extension/mobile) drive their Prev/Next from it, so the boundary
// behaviour can't drift between them. Pure + platform-free: it takes plain
// numbers, never a PageReader, so it unit-tests without any fetch or renderer
// and stays usable from the extension's own PageSegment shape.

export interface PartCursor {
  page: number;
  /** 0-based index into that page's `segments`. */
  part: number;
}

// Crossing a page boundary is a two-step move: we know WHICH page we're going
// to, but not how many segments it has until its fetch resolves. The cursor
// therefore carries an intent — "land on the first/last segment of the new
// page" — that `settlePart` resolves once the segment count is known. Going
// backwards needs "last", or Prev from p.293 part 0 would land on p.292's first
// segment and silently skip its later ones.
export type PendingPart = "first" | "last";

export interface PendingCursor {
  page: number;
  part: number | PendingPart;
}

/**
 * Which segment of the current page holds the surah the route was entered on.
 *
 * Entering a surah routes to its `pageStart`, and for any surah that begins
 * mid-page that page's FIRST segment is the *preceding* surah — tapping Al-Kahf
 * lands on p.293, whose segment 0 is Al-Israa's tail. Opening there would show
 * the wrong surah entirely. Falls back to 0 if the surah isn't on the page
 * (stale/malformed data), which is the old behaviour rather than a crash.
 */
export function resolveEntryPart(surahNumbers: number[], entrySurah: number): number {
  const index = surahNumbers.indexOf(entrySurah);
  return index >= 0 ? index : 0;
}

/** Next flip, or null at the very end of the mushaf. */
export function nextPartCursor(
  cursor: PartCursor,
  partCount: number,
  nextPage: number | null,
): PendingCursor | null {
  if (cursor.part + 1 < partCount) return { page: cursor.page, part: cursor.part + 1 };
  if (nextPage === null) return null;
  return { page: nextPage, part: "first" };
}

/** Previous flip, or null at the very start of the mushaf. */
export function prevPartCursor(cursor: PartCursor, prevPage: number | null): PendingCursor | null {
  if (cursor.part > 0) return { page: cursor.page, part: cursor.part - 1 };
  if (prevPage === null) return null;
  return { page: prevPage, part: "last" };
}

/**
 * Resolve a cursor's part once the target page's segment count is known.
 * Clamps, so a numeric part left over from a longer page can never index past
 * the end of a shorter one.
 */
export function settlePart(part: number | PendingPart, partCount: number): number {
  const lastIndex = Math.max(0, partCount - 1);
  if (part === "first") return 0;
  if (part === "last") return lastIndex;
  return Math.min(Math.max(0, part), lastIndex);
}
