// Deterministic gradient + initials avatar for Quran reciters that have no photo.
// Pure + framework-agnostic so web (a gradient <div>), mobile (an RN <View>), and
// the extension (a gradient <div>) all render an identical fallback for the same
// reciter. Keyed by the reciter `slug` so the assignment is stable across renders,
// locale switches, and all three surfaces.

// Warm dark gradient pairs [from, to], mirroring the playlists cover-art palette
// so the home surfaces feel of a piece.
export const RECITER_GRADIENTS = [
  ["#2d4a1e", "#1a2a10"], // forest green
  ["#3d2a0e", "#2a1a06"], // warm amber
  ["#1e2a3d", "#0e1825"], // deep navy
  ["#2a1e3d", "#180e28"], // purple dusk
  ["#3d1e2a", "#280e18"], // rose dark
  ["#1e3d2a", "#0e2818"], // emerald
] as const;

// Stable hash of the FULL slug → gradient index.
//
// NOTE: the playlists cover-art helper uses `parseInt(id.slice(-2), 16)`, which is
// `NaN` for non-hex text slugs (`"alafasy".slice(-2)` = `"sy"` → NaN) — every
// reciter would collapse onto gradient[0]. Summing char codes distributes text
// slugs across the whole palette instead.
export function reciterGradientIndex(slug: string): number {
  let sum = 0;
  for (let i = 0; i < slug.length; i += 1) sum += slug.charCodeAt(i);
  return sum % RECITER_GRADIENTS.length;
}

export function reciterGradient(slug: string): readonly [string, string] {
  return RECITER_GRADIENTS[reciterGradientIndex(slug)] ?? RECITER_GRADIENTS[0]!;
}

// Initials from the first + last whitespace-delimited word, upper-cased. Arabic
// has no letter case so `toUpperCase()` is a no-op there. Examples:
//   "Mishary Rashid Alafasy" → "MA"
//   "Nasser Al Qatami"       → "NQ"
//   "Sudais"                 → "S"
//   "مشاري راشد العفاسي"      → "ما"
export function reciterInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0]!.charAt(0);
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
}
