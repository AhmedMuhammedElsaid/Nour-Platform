import { LOCALES } from "../schemas/locale";

/*
 * Flattens the embedded-locale sub-objects of a partial update into Mongo
 * dot-path keys so a `$set` MERGES into `ar`/`en` instead of REPLACING them.
 *
 * Why: documents store locale content as embedded sub-objects
 * (`ar: { title, slug, description }`, `en: { … }`). A partial admin edit sends
 * only the changed fields (e.g. `{ ar: { title } }`). Passing that straight to
 * `$set` overwrites the entire `ar` sub-object, silently dropping `slug` and
 * `description`. Expanding to `{ "ar.title": … }` updates just that field and
 * leaves the untouched siblings intact.
 *
 * Only the locale keys (ar/en) are expanded one level deep; every other key
 * (status, categoryIds, coverMediaId, order, durationSecs, …) passes through
 * unchanged. An empty locale object contributes nothing (no-op), so it can
 * never blank out a stored sub-object.
 */
const LOCALE_KEYS = new Set<string>(LOCALES);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function flattenLocaleUpdate(
  update: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(update)) {
    if (LOCALE_KEYS.has(key) && isPlainObject(value)) {
      for (const [subKey, subValue] of Object.entries(value)) {
        out[`${key}.${subKey}`] = subValue;
      }
    } else {
      out[key] = value;
    }
  }
  return out;
}
