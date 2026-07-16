// Home "Adhkar" preview shelf constants — shared by web/mobile/extension.
export const ADHKAR_PREVIEW_COUNT = 5;

// Positional, not slug-keyed — coupled to the curated `order` seeded by
// scripts/seed-adhkar.ts ([morning, evening, sleep, wake, prayer, mosque]).
// If that order ever changes, update this array to match.
export const ADHKAR_PREVIEW_ICONS = ["🌅", "🌙", "😴", "⏰", "🤲"] as const;

export function previewAdhkarIcon(index: number): string {
  return ADHKAR_PREVIEW_ICONS[index] ?? "📿";
}
