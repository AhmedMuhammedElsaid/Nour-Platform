// Strips the Basmala that the source dataset prepends to ayah 1.
//
// `scripts/seed-quran.ts` seeds from Al-Quran Cloud's `quran-uthmani`, which
// embeds "بسم الله الرحمن الرحيم" INSIDE the text of ayah 1 of every surah
// except Al-Fatiha (1) and At-Tawbah (9). Every surface also renders a
// standalone Basmala as chrome above ayah 1, so it printed twice — visible in
// both Mushaf and list mode.
//
// Matching is done on the LETTER SKELETON, never by comparing against a literal.
// Uthmani combining marks are visually indistinguishable when reordered — a
// swapped shadda/fatha pair already shipped once (`e246d7f`) and a hand-retyped
// literal silently fails to match. Skipping every mark makes the match immune to
// that whole bug class, and to vowelling differences between editions.

// Zero-advance marks that may appear anywhere between the base letters:
// harakat/tanwin (064B-065F), superscript alef (0670), Quranic annotation signs
// (06D6-06ED), tatweel (0640), bidi/zero-width controls, and whitespace.
const SKIP = "[\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u0640\\u200B-\\u200F\\s]*";

// Alef wasla (ٱ, U+0671) in the Uthmani script, plain alef (ا) elsewhere.
const ALEF = "[\\u0627\\u0671]";

// ب س م · ٱ ل ل ه · ٱ ل ر ح م ن · ٱ ل ر ح ي م
const LETTERS = [
  "ب", "س", "م",
  ALEF, "ل", "ل", "ه",
  ALEF, "ل", "ر", "ح", "م", "ن",
  ALEF, "ل", "ر", "ح", "ي", "م",
];

const LEADING_BASMALA = new RegExp(`^${SKIP}${LETTERS.join(SKIP)}${SKIP}`);

/**
 * True for the ayahs that carry the dataset's prepended Basmala. Al-Fatiha's
 * Basmala IS its ayah 1 and At-Tawbah has none, so both are left alone — as is
 * An-Naml 27:30, whose Basmala is genuine Quranic text but sits mid-surah, not
 * at ayah 1.
 */
function hasPrependedBasmala(surah: number, ayahInSurah: number): boolean {
  return ayahInSurah === 1 && surah !== 1 && surah !== 9;
}

/**
 * Removes a leading Basmala from ayah 1's text. Idempotent — safe to run over
 * already-cleaned data, which is what lets the migration be re-run and the seed
 * script apply it unconditionally.
 */
export function stripLeadingBasmala(text: string, surah: number, ayahInSurah: number): string {
  if (!hasPrependedBasmala(surah, ayahInSurah)) return text;

  const stripped = text.replace(LEADING_BASMALA, "");
  // A surah whose entire ayah 1 is the Basmala would be emptied — never true in
  // the real mushaf, but a data glitch shouldn't blank an ayah.
  return stripped.length > 0 ? stripped : text;
}

// The Uthmani Basmala, as rendered above a surah. THE canonical copy for every
// surface — import it, never retype it.
//
// Why this exists as a constant: Arabic combining marks are visually identical
// when reordered, so a hand-typed copy differs in bytes while looking correct,
// and whoever retypes the string retypes the test assertion with it — meaning a
// full green test suite proves nothing. That shipped once (`e246d7f`) and was
// reintroduced three times in a single session on 2026-07-26, once passing a
// 25/25 gate with corrupted scripture on screen. Removing the second copy is the
// only control that actually holds; a byte diff is the only way to verify one.
export const BISMILLAH_UTHMANI = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
