# Azkar Feature — Deployment & Dev Run Guide

> Branch: `feature/adhkar` (worktree at `D:\CodeLab\Nour-adhkar`)
> Commits: `780635a`..`2f5052a` (20 commits)

This guide covers everything you need to go from "fresh checkout" to "running Azkar in the browser" — for local dev and for production Atlas.

---

## 1. Pre-flight checklist

Before anything else, confirm you have:

- [ ] `MONGODB_URI` pointing at your Atlas cluster (dev or prod)
- [ ] All three `.env.local` files populated (root + `apps/web` + `apps/admin`). See `.env.example` for the required vars.
- [ ] `pnpm install` run from the monorepo root (or the worktree — it has its own `node_modules`)

---

## 2. Run the migration (Atlas — once per environment)

> ⚠️ **Critical rule from APP_CONTEXT:** Do NOT run `pnpm migrate` (the full chain) against embedded production data — it can corrupt existing docs if earlier migrations replay badly. Instead, run **only migration 0008** in isolation.

### Option A — run only 0008 (recommended for existing Atlas DBs)

The migrate runner supports a `--only <name>` flag for exactly this — run a
single migration without replaying the one-time embedded-locale transforms:

```bash
# From repo root:
pnpm migrate --only 0008-azkar-indexes

# Confirm resolution first without writing, if you like:
pnpm migrate --only 0008-azkar-indexes --dry-run
```

If you are on a **fresh dev DB with no prior data**, the full chain is safe:

### Option B — fresh DB only

```bash
# From repo root:
pnpm migrate
```

This runs: `[0003, 0004, 0005, 0001, 0002, 0006, 0007, 0008]` in that order.

### Verify the indexes exist

In Atlas Data Explorer or mongosh:

```js
use nour  // or your DB name
db.azkar.getIndexes()
// Should show: ar.slug (unique), en.slug (unique), {status,order}, {order}
```

---

## 3. Seed the starter content

The seed script inserts the two canonical sets (Morning + Evening). It is **idempotent** — re-running is safe; it skips sets that already exist.

```bash
# From repo root:
pnpm seed:adhkar
```

Expected output:
```
seeded: أذكار الصباح
seeded: أذكار المساء
```

On a re-run:
```
skip (exists): أذكار الصباح
skip (exists): أذكار المساء
```

> **Note:** The seeded content is minimal (2 items per set). Before public launch, expand `scripts/seed-adhkar.ts` with the full Hisnul Muslim text. You can also create/edit sets through the admin CMS after seeding — no re-run of the seed needed.

---

## 4. Run locally (dev servers)

```bash
# From repo root — starts both web (port 3000) and admin (port 3001):
pnpm dev

# Or just the public web:
pnpm dev:web

# Or just the admin CMS:
pnpm dev:admin
```

### What to verify in the browser

**Public web (`http://localhost:3000`):**

1. Open `/ar/adhkar` — you should see the landing page with "أذكار الصباح" and "أذكار المساء" cards, each with a `0 / 2 today` progress bar.
2. Click a card → reading view (`/ar/adhkar/azkar-alsabah`).
3. The counter button shows `0 / 1`. Tap it — should show `1 / 1` and auto-advance to the next dhikr.
4. Reload the page — progress should resume at `1`.
5. Switch to `/en/adhkar` — cards show English titles, nav link says "Adhkar".

**Admin CMS (`http://localhost:3001`):**

1. Log in → navigate to `/adhkar` — should show the two seeded sets in the table.
2. Click "Edit" on a set → the form opens with the items editor (add/remove/reorder dhikr rows works).
3. Click "New" → create a new set with kind "other".
4. Drag rows in the table to reorder — order is persisted.
5. Toggle publish/unpublish — reflected immediately on the public landing.

---

## 5. Check the nav link

The header now has an "الأذكار / Adhkar" link. If it doesn't appear, confirm the `adhkar` namespace is present in `apps/web/messages/ar.json` and `en.json`.

---

## 6. Run the test suites

```bash
# Unit + integration tests (no DB needed):
pnpm --filter @repo/api test     # expected: 85 passing
pnpm --filter admin test         # expected: 48 passing
pnpm --filter web test           # expected: 87 passing

# Full typecheck:
pnpm turbo run typecheck

# Lint:
pnpm turbo run lint
```

---

## 7. Run the E2E smoke test (requires dev server + seeded DB)

```bash
# Make sure `pnpm dev` is already running in another terminal, then:
pnpm playwright test adhkar.smoke
```

The test covers: landing page loads → click first card → counter shows 0 → tap → shows 1 → reload → still shows 1.

---

## 8. Admin: author more adhkar content

The seed only inserts 2 starter items per set. To add the full Hisnul Muslim set:

1. Log in to admin → `/adhkar` → Edit "أذكار الصباح".
2. Use the items editor to add each dhikr row (Arabic text, repeat count, translation, virtue, source).
3. Click "Update" — changes appear on the public site immediately (cache invalidated).

Or expand `scripts/seed-adhkar.ts` with all items and re-run `pnpm seed:adhkar` (it skips the set-level doc if the slug exists — you'd need to either delete the existing doc first or call the admin update directly).

---

## 9. Production deploy checklist

- [x] Run migration 0008 in isolation on Atlas (`pnpm migrate --only 0008-azkar-indexes`).
- [x] Run `pnpm seed:adhkar` (Morning + Evening sets inserted).
- [x] Deploy — merged to `main` and pushed; Vercel build runs `pnpm turbo run build`.
- [ ] Verify `/ar/adhkar` loads on prod domain.
- [ ] Verify admin `/adhkar` table shows seeded sets.
- [ ] Check that the Adhkar nav link appears in the site header.

---

## 10. Stash / branch notes

```bash
# Switch back to your prayer-times work (main checkout):
# Your WIP playlists-table.tsx change is in stash@{0}
cd "D:\CodeLab\Nour Platform"
git checkout feature/quran-reader
git stash pop   # restores playlists-table.tsx WIP

# The adhkar branch lives in the separate worktree:
# D:\CodeLab\Nour-adhkar  →  feature/adhkar
# When done, merge feature/adhkar into main (or open a PR).

# To remove the worktree once merged:
git worktree remove "D:\CodeLab\Nour-adhkar"
```

---

## 11. Known follow-ups (not blocking)

| Item | Note |
|---|---|
| Expand seed content | Full Hisnul Muslim text — add via admin CMS or update `scripts/seed-adhkar.ts` (editorial task; only 2 starter items per set ship) |
| Per-item audio upload | `audioMediaId` field is wired; the admin form has a plain text input for the media ID. Full R2 upload UI (like track uploader) deferred. |
| Per-item inline validation errors | Schema validates on submit; field-level error display for dhikr rows can be added to `azkar-items-editor.tsx` |
| ~~Localize reader chrome~~ | ✅ Done — Prev/Next + counter `aria-label` routed through next-intl `adhkar` namespace. |
| ~~Over-count guard on last item~~ | ✅ Done — reader ignores taps once an item hits its repeat target. |
| Resume-from-store visible in UI | Progress bar on the landing card updates on mount; consider adding a "completed today ✓" badge |
