// Deterministic cover art color + emoji fallback for playlists without a cover
// image. Ported verbatim from apps/web/features/playlists/lib/cover-art.ts —
// the index is derived from the last two hex chars of the playlist id so the
// assignment is stable across renders and locale switches.
//
// RN has no CSS gradient primitive (and expo-linear-gradient isn't a dep yet),
// so the mobile cover renders a solid `from` color behind the emoji. The web's
// second gradient stop is kept here for parity / future use.

const GRADIENTS = [
  ["#2d4a1e", "#1a2a10"], // forest green
  ["#3d2a0e", "#2a1a06"], // warm amber
  ["#1e2a3d", "#0e1825"], // deep navy
  ["#2a1e3d", "#180e28"], // purple dusk
  ["#3d1e2a", "#280e18"], // rose dark
  ["#1e3d2a", "#0e2818"], // emerald
] as const;

const EMOJIS = [
  "📿", "🕌", "📖", "🌕", "🕋", "🌙",
  "🌒", "🌓", "🌔", "🌕", "🌟", "✨",
  "📿", "🕌", "☪️", "🎙️", "🕊️", "❤️", "⭐",
] as const;

function coverIndex(id: string): number {
  return parseInt(id.slice(-2), 16) % GRADIENTS.length;
}

export function getCoverGradient(id: string): readonly [string, string] {
  return GRADIENTS[coverIndex(id)] ?? GRADIENTS[0]!;
}

export function getCoverEmoji(id?: string): string {
  const key = id ?? Math.floor(Math.random() * EMOJIS.length).toString();
  return EMOJIS[coverIndex(key)] ?? EMOJIS[0]!;
}
