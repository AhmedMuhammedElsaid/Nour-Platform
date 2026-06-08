/*
 * Shared slug generator. De-duplicated from the three identical copies that
 * previously lived in playlist/category/track services.
 *
 * Unicode-aware (ADR 0002): letters/numbers of ANY script are kept, so an
 * Arabic title produces a non-empty slug. Latin text is lowercased; Arabic has
 * no case so it is unaffected. Whitespace collapses to single hyphens and
 * leading/trailing/duplicate hyphens are trimmed, matching `slugSchema`
 * (`/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u`).
 *
 * When normalization yields an empty string (e.g. a punctuation-only title),
 * fall back to a short suffix of the document's contentId so a valid, unique
 * slug always exists.
 */
export function slugify(input: string, contentIdFallback?: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200)
    .replace(/^-+|-+$/g, "");

  if (slug.length > 0) return slug;

  return contentIdFallback ? `item-${contentIdFallback.slice(-6)}` : "item";
}
