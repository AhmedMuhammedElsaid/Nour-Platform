// Deterministic cover art gradient + emoji fallback for playlists without a
// scholar photo. Index is derived from the last two hex chars of the id so it's
// stable across renders and locale switches. Exact port of apps/web cover-art.ts.

const GRADIENTS = [
  ["#2d4a1e", "#1a2a10"],
  ["#3d2a0e", "#2a1a06"],
  ["#1e2a3d", "#0e1825"],
  ["#2a1e3d", "#180e28"],
  ["#3d1e2a", "#280e18"],
  ["#1e3d2a", "#0e2818"],
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
