// Home "Adhkar" preview shelf constants — shared by web/mobile/extension.
export const ADHKAR_PREVIEW_COUNT = 5;

// Positional, not slug-keyed — coupled to the curated `order` seeded by
// scripts/seed-adhkar.ts ([morning, evening, sleep, wake, prayer, mosque]).
// If that order ever changes, update this array to match.
export const ADHKAR_PREVIEW_ICONS = ["🌅", "🌙", "😴", "⏰", "🤲"] as const;

export function previewAdhkarIcon(index: number): string {
  return ADHKAR_PREVIEW_ICONS[index] ?? "📿";
}

// Locale-invariant `en.slug` of the "Waking Adhkar" set (scripts/data/adhkar-data.ts
// title "Waking Adhkar" — slugify() is deterministic, and slugs are frozen at doc
// creation, so this stays correct even if the seed's display title text is edited
// later). Owner asked (2026-07-17) to hide this ONE set from the web + mobile home
// shelves specifically, while the extension's home shelf keeps all 5 unchanged.
export const ADHKAR_WAKE_EN_SLUG = "waking-adhkar";

export type AdhkarPreviewEntry<T> = { set: T; icon: string };

// Slices the first ADHKAR_PREVIEW_COUNT sets, tags each with its ORIGINAL
// positional icon (before any filtering — so a later filter can't shift icons
// onto the wrong set), then optionally drops the Wake-up entry.
export function buildAdhkarPreview<T extends { en: { slug: string } }>(
  sets: T[],
  options: { excludeWake?: boolean } = {},
): AdhkarPreviewEntry<T>[] {
  const tagged = sets
    .slice(0, ADHKAR_PREVIEW_COUNT)
    .map((set, index) => ({ set, icon: previewAdhkarIcon(index) }));

  if (!options.excludeWake) return tagged;
  return tagged.filter(({ set }) => set.en.slug !== ADHKAR_WAKE_EN_SLUG);
}
