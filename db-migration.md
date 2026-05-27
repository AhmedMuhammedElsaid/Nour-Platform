# DB Migration Guide

How the migration system works and how to run it.

---

## How it works

### The pieces

| File | Role |
|---|---|
| `scripts/migrate.ts` | Runner — connects to MongoDB, loops through migrations in order, disconnects |
| `packages/api/src/db/migrations/NNNN-*.ts` | Individual migrations — each exports `name: string` and `up(): Promise<void>` |
| `packages/api/package.json` → `exports` | Makes each migration importable as `@repo/api/db/migrations/NNNN-*` |
| root `package.json` → `"migrate"` script | `tsx --env-file-if-exists=.env.local scripts/migrate.ts` |

### What the runner does

1. Parses `--dry-run` flag via `node:util` `parseArgs`.
2. Calls `getDb()` to open the Mongoose/MongoDB connection.
3. Iterates `migrations[]` in array order — **not alphabetical, not numeric** (see order section below).
4. For each migration: logs `running: <name>`, calls `migration.up()`, logs `done: <name>`.
5. Calls `disconnectDb()` in a `finally` block regardless of success or failure.

### Migration contract

Every migration module must:

- Export `name: string` — used for log output only, no tracking table.
- Export `async function up(): Promise<void>` — the actual work.
- Be **idempotent** — safe to re-run against an already-migrated database. Mongoose's `ensureIndexes()` is idempotent by nature. Data-backfill migrations skip docs that already have the target fields.

There is no "down" migration or tracking table. The invariant is: run the full script, and the DB is in the correct state. Re-running is always safe.

---

## Current migrations and their order

The runner in `scripts/migrate.ts` defines this array (not `[0001, 0002, 0003, 0004, 0005]`):

```
[0003, 0004, 0005, 0001, 0002]
```

### Why this order matters

```
0003 → must backfill locale/contentId on all existing docs
        before ANY index that touches those fields is built

0004 → drops obsolete single-locale unique indexes (slug_1, etc.)
        before 0001/0002 try to ensureIndexes() with the new compound specs

0005 → collapses per-locale AR/EN documents into single embedded-locale docs;
        drops ALL indexes itself, then calls ensureIndexes() at the end

0001 → calls ensureIndexes() on Playlist/Track/Media — no-op because 0005 already did it

0002 → calls ensureIndexes() on Playlist + creates playlists.categoryIds index — idempotent
```

If you swap the order (e.g. run 0001 before 0003), MongoDB will try to build the
`{contentId, locale}` compound unique index while existing docs still have `null`
for both fields → `E11000 duplicate key error`.

### What each migration does

| Migration | What it does |
|---|---|
| `0001-indexes` | `ensureIndexes()` on Playlist, Track, Media models |
| `0002-category-indexes` | Creates `playlists.categoryIds` non-unique index; `ensureIndexes()` on Playlist |
| `0003-i18n-backfill` | Sets `locale='ar'` + mints `contentId` on every pre-i18n doc; relinks tracks via `playlistContentId`; unsets old `playlistId`/`trackIds` fields. Skips docs that already have `locale`. |
| `0004-i18n-indexes` | Drops obsolete `slug_1` / `playlistId_*` indexes; rebuilds compound `{locale,slug}` + `{contentId,locale}` unique indexes via `ensureIndexes()` |
| `0005-embedded-locale` | Merges per-locale AR+EN doc pairs into single docs with `ar:{…}` / `en:{…}` sub-objects; remaps `categoryIds` and `playlistContentId` → `playlistId`; drops all indexes first, rebuilds at the end |

---

## Running migrations

### Prerequisites

- `MONGODB_URI` must be set (in `.env.local` at the repo root, or as a shell env var).
- `AUTH_SECRET` must be set (the `@repo/config/env` barrel validates both at load time).
- Run from the **repo root** (not inside any app or package).

### Dry run (no DB writes)

```sh
pnpm migrate --dry-run
```

Output lists which migrations *would* run. Connection is opened, but `up()` is never called.

### Live run

```sh
pnpm migrate
```

Or with env vars inline (overrides `.env.local`):

```sh
MONGODB_URI="mongodb+srv://…" AUTH_SECRET="…" pnpm migrate
```

> **Note:** Do NOT use `pnpm migrate -- --dry-run` (with a `--` separator). pnpm forwards the literal `--` and the runner's strict `parseArgs` rejects it as a positional argument.

### Expected output (success)

```
[migrate] running: 0003-i18n-backfill …
[migrate] done:    0003-i18n-backfill
[migrate] running: 0004-i18n-indexes …
[migrate] done:    0004-i18n-indexes
[migrate] running: 0005-embedded-locale …
[migrate] done:    0005-embedded-locale
[migrate] running: 0001-indexes …
[migrate] done:    0001-indexes
[migrate] running: 0002-category-indexes …
[migrate] done:    0002-category-indexes

[migrate] all migrations applied successfully.
```

### Dry run output

```
[migrate] dry-run mode — no indexes will be created.

[migrate] would run: 0003-i18n-backfill
[migrate] would run: 0004-i18n-indexes
[migrate] would run: 0005-embedded-locale
[migrate] would run: 0001-indexes
[migrate] would run: 0002-category-indexes

[migrate] dry-run complete. No changes made.
```

---

## Adding a new migration

1. Create `packages/api/src/db/migrations/NNNN-<name>.ts`:

   ```ts
   import { getDb } from "../client";

   export const name = "NNNN-<name>";

   export async function up(): Promise<void> {
     const conn = await getDb();
     const db = conn.connection.db!;
     // your idempotent work here
   }
   ```

2. Add an `exports` entry in `packages/api/package.json`:

   ```json
   "./db/migrations/NNNN-<name>": "./src/db/migrations/NNNN-<name>.ts"
   ```

   Without this entry `scripts/migrate.ts` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

3. Add an import and entry to `scripts/migrate.ts`:

   ```ts
   import * as migrationNNNN from "@repo/api/db/migrations/NNNN-<name>";

   const migrations: Migration[] = [
     // … existing entries …
     migrationNNNN,   // append, or insert at the correct position if order matters
   ];
   ```

4. Document any ordering constraints in the comment above the `migrations` array.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `ERR_PACKAGE_PATH_NOT_EXPORTED` | Missing `exports` entry in `packages/api/package.json` | Add the entry (step 2 above) |
| `E11000 duplicate key error` on `{contentId,locale}` | 0003 didn't run before 0004/0001 | Don't reorder the runner array |
| `TypeError: Cannot read properties of undefined (reading 'toString')` in admin `/playlists` | Pre-i18n docs missing `contentId` — 0003 hasn't run | Run `pnpm migrate` |
| `pnpm migrate -- --dry-run` fails with "unexpected positional argument" | pnpm forwards the literal `--` | Use `pnpm migrate --dry-run` (no separator) |
| Build-time env error from `@repo/config/env` | `MONGODB_URI` or `AUTH_SECRET` not set | Set both before running the script |
