#!/usr/bin/env node
import { getDb, disconnectDb } from "@repo/api/db/client";
import { slugify } from "@repo/api/utils/slug";
import { LOCALES } from "@repo/api/schemas/locale";

/*
 * Heal slugs that violate the kebab-case invariant the public router relies on.
 *
 * Background: a malformed slug containing whitespace (e.g. an Arabic title
 * imported verbatim, "مقتطفات للدكتور صابر عادل") renders an <a href> with raw
 * spaces. On a client-side <Link> navigation Next re-encodes that space to a
 * form decodeURIComponent can't restore, so getPlaylistBySlug finds nothing and
 * the detail page 404s (with a React #418 hydration error on the 404 body).
 * slugSchema rejects spaces, so such docs can only enter via a direct
 * DB insert/import that bypasses Zod — this script repairs them after the fact.
 *
 * Strategy: for each ar/en slug that is missing, blank, whitespace-bearing, or
 * not-trimmed, re-derive it via the canonical `slugify` (from the existing slug
 * first, falling back to the title). Idempotent: a well-formed slug slugifies to
 * itself and is left untouched. Collisions within a collection+locale get a
 * "-2"/"-3" suffix. Uses dotted $set paths so the embedded ar/en subdoc MERGES
 * (never clobbers description/scholarName) — same rule as flattenLocaleUpdate.
 *
 * Usage:
 *   pnpm heal:malformed-slugs            # dry-run (prints planned changes)
 *   pnpm heal:malformed-slugs --apply    # write the changes to Atlas
 */

const APPLY = process.argv.includes("--apply");

function isMalformed(slug: unknown): boolean {
  if (typeof slug !== "string" || slug.length === 0) return true;
  if (/\s/.test(slug)) return true;
  if (slug !== slug.trim()) return true;
  return slug !== slugify(slug);
}

async function main(): Promise<void> {
  const m = await getDb();
  let changed = 0;
  try {
    const db = m.connection.db!;
    for (const coll of ["playlists", "tracks", "categories"] as const) {
      const collection = db.collection(coll);
      const docs = await collection.find({}).toArray();
      // Track taken slugs per locale so we can de-dupe within this collection.
      const taken: Record<string, Set<string>> = {};
      for (const l of LOCALES) {
        taken[l] = new Set(
          docs.map((d) => d[l]?.slug).filter((s): s is string => typeof s === "string"),
        );
      }

      for (const d of docs) {
        const set: Record<string, string> = {};
        for (const l of LOCALES) {
          const cur: unknown = d[l]?.slug;
          if (!isMalformed(cur)) continue;

          const source = typeof cur === "string" && cur.trim() ? cur : (d[l]?.title ?? "");
          let next = slugify(source, String(d._id));
          // De-dupe against other docs' slugs in the same locale.
          if (typeof cur === "string") taken[l]!.delete(cur);
          let n = 2;
          const base = next;
          while (taken[l]!.has(next)) next = `${base}-${n++}`;
          taken[l]!.add(next);

          set[`${l}.slug`] = next;
          console.log(`${coll} ${String(d._id)} ${l}: ${JSON.stringify(cur)} -> ${JSON.stringify(next)}`);
        }
        if (Object.keys(set).length === 0) continue;
        changed++;
        if (APPLY) await collection.updateOne({ _id: d._id }, { $set: set });
      }
    }
    console.log(
      `\n${APPLY ? "APPLIED" : "DRY-RUN"} — ${changed} document(s) ${APPLY ? "updated" : "would change"}.`,
    );
    if (!APPLY && changed > 0) console.log("Re-run with --apply to write.");
  } finally {
    await disconnectDb();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
